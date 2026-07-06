import { appendValue, html } from './dom'
import { bindEvent } from './events'
import { applyProps, setPropertyOrAttribute } from './props'
import { readValue } from './value'
import type { RenderValue } from './types'
import {
  createElementForTag,
  FABRICA_FABRICA_SPREAD_PREFIX,
  FABRICA_FABRICA_SPREAD_SUFFIX,
  FABRICA_VALUE_PREFIX,
  FABRICA_VALUE_SUFFIX,
  isVoidTag,
  normalizeAttributeName,
  normalizeTemplateStrings,
  readSpreadMarker,
  readValueMarker,
  unquote,
} from './compiler-utils'

export interface FabricaCompiledElementProps {
  readonly [key: string]: unknown
}

/**
 * Creates a DOM element through the same runtime prop/event/child primitives used by Fábrica.
 *
 * The compiled path is intentionally tiny: it owns `document.createElement` and tree assembly,
 * while prop normalization, style/class maps, event modifiers, cleanup and child materialization
 * continue to live in the runtime modules (`applyProps`, `bindEvent`, `appendValue`).
 */
export function createCompiledElement(
  tag: string | ((props: FabricaCompiledElementProps) => RenderValue),
  props: FabricaCompiledElementProps | null,
  ...children: readonly RenderValue[]
): RenderValue {
  if (typeof tag === 'function') return tag({ ...(props ?? {}), children })

  const element = createElementForTag(tag)
  applyCompiledProps(element, props)
  for (const child of children) appendValue(element, child)
  return element
}

/** Creates a document fragment from already compiled children. */
export function createCompiledFragment(...children: readonly RenderValue[]): DocumentFragment {
  const fragment = document.createDocumentFragment()
  for (const child of children) appendValue(fragment, child)
  return fragment
}

/**
 * Runtime helper used by the build transform for dynamic templates.
 *
 * It parses the template once into a tiny compiled tree and hydrates every call with the current
 * interpolation values. Unsupported advanced forms safely fall back to `html```, preserving every
 * existing Fábrica feature instead of maintaining a second implementation.
 */
export function createCompiledTemplate(strings: TemplateStringsArray | readonly string[], ...values: readonly RenderValue[]): DocumentFragment {
  const normalized = normalizeTemplateStrings(strings)
  const compiled = getCachedCompiledRuntimeTemplate(normalized)
  if (!compiled) return html(normalized as TemplateStringsArray, ...values)

  try {
    const fragment = document.createDocumentFragment()
    for (const node of compiled.nodes) appendCompiledNode(fragment, node, values)
    return fragment
  } catch {
    return html(normalized as TemplateStringsArray, ...values)
  }
}

/** Applies compiled props and event listeners to an element using runtime semantics. */
export function applyCompiledProps(element: Element, props: FabricaCompiledElementProps | null | undefined): void {
  if (!props) return

  const plainProps: Record<string, unknown> = {}

  for (const [rawName, rawValue] of Object.entries(props)) {
    const value = readValue(rawValue)
    if (value == null || value === false) continue

    if (rawName === 'children') continue

    if (rawName === 'ref' && typeof value === 'function') {
      const cleanup = (value as (node: Element) => void | (() => void))(element)
      if (typeof cleanup === 'function') {
        // `appendValue`/render disposal owns the subtree cleanup; ref cleanup is already handled by
        // the runtime template path. In direct compiled creation we keep the call synchronous and
        // intentionally avoid importing cleanup internals here.
      }
      continue
    }

    if (rawName.startsWith('@')) {
      bindEvent(element, rawName.slice(1), value as RenderValue)
      continue
    }

    if (isEventPropName(rawName)) {
      bindEvent(element, eventNameFromProp(rawName), value as RenderValue)
      continue
    }

    if (rawName.startsWith('.')) {
      setPropertyOrAttribute(element, rawName.slice(1), value)
      continue
    }

    if (rawName.startsWith('?')) {
      setPropertyOrAttribute(element, rawName.slice(1), Boolean(value))
      continue
    }

    plainProps[rawName === 'className' ? 'class' : rawName] = value
  }

  applyProps(element, plainProps)
}

interface RuntimeCompiledTemplate { readonly nodes: readonly RuntimeNode[] }
interface RuntimeElementNode { readonly type: 'element'; readonly tag: string; readonly props: readonly RuntimeProp[]; readonly children: RuntimeNode[] }
interface RuntimeTextNode { readonly type: 'text'; readonly value: string }
interface RuntimeValueNode { readonly type: 'value'; readonly index: number }
type RuntimeNode = RuntimeElementNode | RuntimeTextNode | RuntimeValueNode
type RuntimeProp =
  | { readonly type: 'static'; readonly name: string; readonly value: string | true }
  | { readonly type: 'value'; readonly name: string; readonly index: number }
  | { readonly type: 'spread'; readonly index: number }

const runtimeTemplateCache = new Map<string, RuntimeCompiledTemplate | null>()

function getCachedCompiledRuntimeTemplate(strings: readonly string[]): RuntimeCompiledTemplate | null {
  const key = strings.join('\u001f')
  if (runtimeTemplateCache.has(key)) return runtimeTemplateCache.get(key) ?? null
  const compiled = compileRuntimeTemplate(strings)
  runtimeTemplateCache.set(key, compiled)
  return compiled
}

function compileRuntimeTemplate(strings: readonly string[]): RuntimeCompiledTemplate | null {
  if (containsUnsupportedTemplateShape(strings)) return null
  const source = buildCompiledRuntimeSource(strings)
  const roots = parseRuntimeNodes(source)
  return roots ? { nodes: roots } : null
}

function containsUnsupportedTemplateShape(strings: readonly string[]): boolean {
  for (let index = 0; index < strings.length; index += 1) {
    const chunk = strings[index] ?? ''
    if (chunk.endsWith('<') || chunk.endsWith('</')) return true
    if (/<\/?[A-Z][A-Za-z0-9_$.-]*/.test(chunk)) return true
  }
  return false
}

function buildCompiledRuntimeSource(strings: readonly string[]): string {
  let output = ''
  for (let index = 0; index < strings.length; index += 1) {
    const chunk = strings[index] ?? ''
    if (index < strings.length - 1 && /\.\.\.\s*$/.test(chunk) && chunk.lastIndexOf('<') > chunk.lastIndexOf('>')) {
      output += chunk.replace(/\.\.\.\s*$/, '')
      output += ` ${FABRICA_SPREAD_PREFIX}${index}${FABRICA_SPREAD_SUFFIX}`
      continue
    }
    output += chunk
    if (index < strings.length - 1) output += `${FABRICA_VALUE_PREFIX}${index}${FABRICA_VALUE_SUFFIX}`
  }
  return output
}

function appendCompiledNode(parent: Node, node: RuntimeNode, values: readonly RenderValue[]): void {
  if (node.type === 'text') {
    appendValue(parent, node.value)
    return
  }
  if (node.type === 'value') {
    appendValue(parent, values[node.index])
    return
  }

  const element = createElementForTag(node.tag)
  const props: Record<string, unknown> = {}

  for (const prop of node.props) {
    if (prop.type === 'spread') {
      applyCompiledProps(element, values[prop.index] as FabricaCompiledElementProps)
      continue
    }
    props[prop.name] = prop.type === 'value' ? values[prop.index] : prop.value
  }

  applyCompiledProps(element, props)
  for (const child of node.children) appendCompiledNode(element, child, values)
  parent.appendChild(element)
}

function parseRuntimeNodes(source: string): RuntimeNode[] | null {
  const root: RuntimeElementNode = { type: 'element', tag: '#fragment', props: [], children: [] }
  const stack: RuntimeElementNode[] = [root]
  let index = 0

  while (index < source.length) {
    const lt = source.indexOf('<', index)
    if (lt < 0) { pushRuntimeText(source.slice(index)); break }
    pushRuntimeText(source.slice(index, lt))
    const gt = source.indexOf('>', lt + 1)
    if (gt < 0) return null
    const token = source.slice(lt + 1, gt).trim()
    if (!token || token.startsWith('!') || token.startsWith('?')) return null

    if (token.startsWith('/')) {
      const closing = token.slice(1).trim().toLowerCase()
      const node = stack.pop()
      if (!node || node === root || node.tag.toLowerCase() !== closing) return null
    } else {
      const selfClosing = token.endsWith('/')
      const open = selfClosing ? token.slice(0, -1).trim() : token
      const parsed = parseRuntimeOpenTag(open)
      if (!parsed) return null
      stack[stack.length - 1]!.children.push(parsed)
      if (!selfClosing && !isVoidTag(parsed.tag)) stack.push(parsed)
    }
    index = gt + 1
  }

  if (stack.length !== 1) return null
  return root.children

  function pushRuntimeText(value: string): void {
    if (!value) return
    const current = stack[stack.length - 1]!
    let cursor = 0
    const markerRe = /%%fabrica_value_(\d+)%%/g
    let match: RegExpExecArray | null
    while ((match = markerRe.exec(value))) {
      const before = value.slice(cursor, match.index)
      if (before) current.children.push({ type: 'text', value: before })
      current.children.push({ type: 'value', index: Number(match[1]) })
      cursor = markerRe.lastIndex
    }
    const tail = value.slice(cursor)
    if (tail) current.children.push({ type: 'text', value: tail })
  }
}

function parseRuntimeOpenTag(open: string): RuntimeElementNode | null {
  const match = open.match(/^([A-Za-z][A-Za-z0-9:-]*)([\s\S]*)$/)
  if (!match) return null
  const tag = match[1]!
  if (/^[A-Z]/.test(tag)) return null
  const props = parseRuntimeAttributes(match[2] ?? '')
  if (!props) return null
  return { type: 'element', tag, props, children: [] }
}

function parseRuntimeAttributes(source: string): RuntimeProp[] | null {
  const props: RuntimeProp[] = []
  const re = /([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'<>`=]+))?/g
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    if (source.slice(cursor, match.index).trim()) return null
    const rawName = match[1]!
    const rawValue = match[2]
    const spread = readSpreadMarker(rawName)
    if (spread != null) props.push({ type: 'spread', index: spread })
    else {
      const name = normalizeAttributeName(rawName)
      const value = rawValue == null ? true : unquote(rawValue)
      const marker = typeof value === 'string' ? readValueMarker(value) : null
      props.push(marker != null ? { type: 'value', name, index: marker } : { type: 'static', name, value })
    }
    cursor = re.lastIndex
  }
  if (source.slice(cursor).trim()) return null
  return props
}

function isEventPropName(name: string): boolean {
  return /^on[A-Z]/.test(name) || /^on[a-z]+(?:[.:_-]|$)/.test(name)
}

function eventNameFromProp(name: string): string {
  const raw = name.startsWith('on') ? name.slice(2) : name
  return raw.charAt(0).toLowerCase() + raw.slice(1)
}
