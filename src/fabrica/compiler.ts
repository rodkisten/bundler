import { appendValue, html } from './dom'
import { bindEvent } from './events'
import { applyProps, setPropertyOrAttribute } from './props'
import { readValue } from './value'
import type { RenderValue } from './types'

export interface FabricaCompiledElementProps {
  readonly [key: string]: unknown
}

export interface FabricaCompileSourceOptions {
  readonly filename?: string
  readonly importPath?: string
  readonly htmlTags?: readonly string[]
  readonly jsxHtmlTags?: readonly string[]
}

export interface FabricaCompileSourceResult {
  readonly code: string
  readonly changed: boolean
  readonly manifest: readonly FabricaCompiledTemplateManifestEntry[]
}

export interface FabricaCompiledTemplateManifestEntry {
  readonly id: string
  readonly filename?: string
  readonly start: number
  readonly end: number
  readonly tag: string
  readonly dynamicValues: number
  readonly fallback: boolean
}

const DEFAULT_IMPORT_PATH = './compiler'
const HTML_TAGS = ['html']
const JSX_HTML_TAGS = ['jsx.html', 'html.jsx']
const VALUE_PREFIX = '%%fabrica_value_'
const VALUE_SUFFIX = '%%'
const SPREAD_PREFIX = '%%fabrica_spread_'
const SPREAD_SUFFIX = '%%'

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

  const element = /^(svg|path|circle|rect|line|polyline|polygon|ellipse|g|defs|symbol|use|text|tspan|linearGradient|radialGradient|stop|clipPath|mask)$/i.test(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag)
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

/** Compiles Fábrica template tags to runtime-backed `document.createElement` helpers. */
export function compileFabricaSource(source: string, options: FabricaCompileSourceOptions = {}): FabricaCompileSourceResult {
  const edits: SourceEdit[] = []
  const manifest: FabricaCompiledTemplateManifestEntry[] = []
  const tags = [...(options.htmlTags ?? HTML_TAGS), ...(options.jsxHtmlTags ?? JSX_HTML_TAGS)]

  for (const tag of tags) {
    let searchFrom = 0
    const marker = `${tag}\``
    while (searchFrom < source.length) {
      const start = source.indexOf(marker, searchFrom)
      if (start < 0) break
      if (!isTagBoundary(source, start)) { searchFrom = start + marker.length; continue }
      const templateStart = start + tag.length
      const templateEnd = findTemplateEnd(source, templateStart)
      if (templateEnd < 0) { searchFrom = start + marker.length; continue }

      const raw = source.slice(templateStart + 1, templateEnd)
      const dynamicValues = countTemplateValues(source, templateStart, templateEnd)
      const templateParts = readTemplateParts(source, templateStart, templateEnd)
      const compiled = dynamicValues === 0 ? compileStaticTemplateToExpression(raw) : null
      const expression = compiled?.expression ?? emitCompiledTemplateExpression(templateParts.strings, templateParts.expressions)

      edits.push({ start, end: templateEnd + 1, value: expression })
      manifest.push({
        id: `fabrica-compiled-${manifest.length + 1}`,
        ...(options.filename ? { filename: options.filename } : {}),
        start,
        end: templateEnd + 1,
        tag: compiled?.rootTag ?? 'template',
        dynamicValues,
        fallback: false,
      })
      searchFrom = templateEnd + 1
    }
  }

  if (edits.length === 0) return { code: source, changed: false, manifest }
  const code = ensureCompiledImport(applyEdits(source, edits.sort((a, b) => a.start - b.start)), options.importPath ?? DEFAULT_IMPORT_PATH)
  return { code, changed: true, manifest }
}

interface SourceEdit { readonly start: number; readonly end: number; readonly value: string }
interface CompiledTemplateExpression { readonly expression: string; readonly rootTag: string }
interface RuntimeCompiledTemplate { readonly nodes: readonly RuntimeNode[] }
interface RuntimeElementNode { readonly type: 'element'; readonly tag: string; readonly props: readonly RuntimeProp[]; readonly children: RuntimeNode[] }
interface RuntimeTextNode { readonly type: 'text'; readonly value: string }
interface RuntimeValueNode { readonly type: 'value'; readonly index: number }
type RuntimeNode = RuntimeElementNode | RuntimeTextNode | RuntimeValueNode
type RuntimeProp =
  | { readonly type: 'static'; readonly name: string; readonly value: string | true }
  | { readonly type: 'value'; readonly name: string; readonly index: number }
  | { readonly type: 'spread'; readonly index: number }

interface ParsedNode { type: 'element'; tag: string; props: Record<string, string | true>; children: ParsedChild[] }
type ParsedChild = ParsedNode | { type: 'text'; value: string }

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
      output += ` ${SPREAD_PREFIX}${index}${SPREAD_SUFFIX}`
      continue
    }
    output += chunk
    if (index < strings.length - 1) output += `${VALUE_PREFIX}${index}${VALUE_SUFFIX}`
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

  const element = /^(svg|path|circle|rect|line|polyline|polygon|ellipse|g|defs|symbol|use|text|tspan|linearGradient|radialGradient|stop|clipPath|mask)$/i.test(node.tag) ? document.createElementNS('http://www.w3.org/2000/svg', node.tag) : document.createElement(node.tag)
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

function compileStaticTemplateToExpression(raw: string): CompiledTemplateExpression | null {
  if (raw.includes('${') || raw.includes('<!') || raw.includes('<template') || raw.includes('</${')) return null
  const root = parseSingleRoot(raw.trim())
  if (!root) return null
  return { expression: emitNode(root), rootTag: root.tag }
}

function parseSingleRoot(source: string): ParsedNode | null {
  const stack: ParsedNode[] = []
  let root: ParsedNode | null = null
  let index = 0
  while (index < source.length) {
    const lt = source.indexOf('<', index)
    if (lt < 0) { pushText(source.slice(index)); break }
    pushText(source.slice(index, lt))
    const gt = source.indexOf('>', lt + 1)
    if (gt < 0) return null
    const token = source.slice(lt + 1, gt).trim()
    if (!token) return null
    if (token.startsWith('/')) {
      const closing = token.slice(1).trim().toLowerCase()
      const node = stack.pop()
      if (!node || node.tag.toLowerCase() !== closing) return null
      if (stack.length === 0) {
        if (root) return null
        root = node
      } else stack[stack.length - 1]!.children.push(node)
    } else {
      const selfClosing = token.endsWith('/')
      const open = selfClosing ? token.slice(0, -1).trim() : token
      const parsed = parseOpenTag(open)
      if (!parsed) return null
      if (selfClosing || isVoidTag(parsed.tag)) {
        if (stack.length === 0) {
          if (root) return null
          root = parsed
        } else stack[stack.length - 1]!.children.push(parsed)
      } else stack.push(parsed)
    }
    index = gt + 1
  }
  if (stack.length !== 0) return null
  return root

  function pushText(value: string): void {
    if (!value || !value.trim()) return
    if (stack.length === 0) return
    stack[stack.length - 1]!.children.push({ type: 'text', value })
  }
}

function parseOpenTag(open: string): ParsedNode | null {
  const match = open.match(/^([A-Za-z][A-Za-z0-9:-]*)([\s\S]*)$/)
  if (!match) return null
  const tag = match[1]!
  if (/^[A-Z]/.test(tag)) return null
  const props = parseStaticAttributes(match[2] ?? '')
  if (!props) return null
  return { type: 'element', tag, props, children: [] }
}

function parseStaticAttributes(source: string): Record<string, string | true> | null {
  const props: Record<string, string | true> = {}
  const re = /([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'<>`=]+))?/g
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    if (source.slice(cursor, match.index).trim()) return null
    const name = match[1]!
    const rawValue = match[2]
    props[normalizeAttributeName(name)] = rawValue == null ? true : unquote(rawValue)
    cursor = re.lastIndex
  }
  if (source.slice(cursor).trim()) return null
  return props
}

function normalizeAttributeName(name: string): string {
  if (name === 'className') return 'class'
  return name
}

function emitNode(node: ParsedNode): string {
  const props = Object.keys(node.props).length > 0 ? JSON.stringify(node.props) : 'null'
  const children = node.children.map(emitChild)
  return `createCompiledElement(${JSON.stringify(node.tag)}, ${props}${children.length ? `, ${children.join(', ')}` : ''})`
}

function emitChild(child: ParsedChild): string {
  return child.type === 'text' ? JSON.stringify(child.value) : emitNode(child)
}

function emitCompiledTemplateExpression(strings: readonly string[], expressions: readonly string[]): string {
  const args = strings.map((item) => JSON.stringify(item)).join(', ')
  const values = expressions.join(', ')
  return `createCompiledTemplate([${args}] as unknown as TemplateStringsArray${values ? `, ${values}` : ''})`
}

function readTemplateParts(source: string, templateStart: number, templateEnd: number): { strings: string[]; expressions: string[] } {
  const raw = source.slice(templateStart + 1, templateEnd)
  const strings: string[] = []
  const expressions: string[] = []
  let cursor = 0
  let index = 0

  while (index < raw.length) {
    if (raw[index] === '$' && raw[index + 1] === '{') {
      strings.push(raw.slice(cursor, index))
      const expressionStart = index + 2
      const expressionEnd = findExpressionEnd(raw, expressionStart)
      if (expressionEnd < 0) break
      expressions.push(raw.slice(expressionStart, expressionEnd).trim())
      cursor = expressionEnd + 1
      index = cursor
      continue
    }
    if (raw[index] === '\\') index += 2
    else index += 1
  }

  strings.push(raw.slice(cursor))
  return { strings, expressions }
}

function findExpressionEnd(source: string, start: number): number {
  let depth = 1
  let quote = ''
  let escaped = false
  let templateDepth = 0

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]!
    const next = source[index + 1]

    if (quote) {
      if (escaped) { escaped = false; continue }
      if (char === '\\') { escaped = true; continue }
      if (quote === '`' && char === '$' && next === '{') { templateDepth += 1; index += 1; continue }
      if (quote === '`' && char === '}' && templateDepth > 0) { templateDepth -= 1; continue }
      if (char === quote && templateDepth === 0) quote = ''
      continue
    }

    if (char === '"' || char === "'" || char === '`') { quote = char; continue }
    if (char === '{') { depth += 1; continue }
    if (char === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return -1
}

function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1)
  return value
}

function readValueMarker(value: string): number | null {
  const match = value.match(/^%%fabrica_value_(\d+)%%$/)
  return match ? Number(match[1]) : null
}

function readSpreadMarker(value: string): number | null {
  const match = value.match(/^%%fabrica_spread_(\d+)%%$/)
  return match ? Number(match[1]) : null
}

function isEventPropName(name: string): boolean {
  return /^on[A-Z]/.test(name) || /^on[a-z]+(?:[.:_-]|$)/.test(name)
}

function eventNameFromProp(name: string): string {
  const raw = name.startsWith('on') ? name.slice(2) : name
  return raw.charAt(0).toLowerCase() + raw.slice(1)
}

function normalizeTemplateStrings(strings: TemplateStringsArray | readonly string[]): TemplateStringsArray {
  if (isTemplateStringsArray(strings)) return strings
  const cooked = strings.slice() as string[] & { raw?: readonly string[] }
  Object.defineProperty(cooked, 'raw', { configurable: false, enumerable: false, value: strings.slice() })
  return cooked as unknown as TemplateStringsArray
}

function isTemplateStringsArray(value: TemplateStringsArray | readonly string[]): value is TemplateStringsArray {
  return Array.isArray(value) && Array.isArray((value as { raw?: unknown }).raw)
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function isVoidTag(tag: string): boolean {
  return /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(tag)
}

function isTagBoundary(source: string, start: number): boolean {
  const before = source[start - 1] ?? ''
  return !/[$\w.]/.test(before)
}

function countTemplateValues(source: string, templateStart: number, templateEnd: number): number {
  let count = 0
  for (let index = templateStart; index < templateEnd; index += 1) if (source[index] === '$' && source[index + 1] === '{') count += 1
  return count
}

function findTemplateEnd(source: string, start: number): number {
  let escaped = false
  let expressionDepth = 0
  let quote = ''
  let templateExpressionDepth = 0

  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index]!
    const next = source[index + 1]

    if (quote) {
      if (escaped) { escaped = false; continue }
      if (char === '\\') { escaped = true; continue }
      if (quote === '`' && char === '$' && next === '{') { templateExpressionDepth += 1; index += 1; continue }
      if (quote === '`' && char === '}' && templateExpressionDepth > 0) { templateExpressionDepth -= 1; continue }
      if (char === quote && templateExpressionDepth === 0) quote = ''
      continue
    }

    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }

    if (expressionDepth > 0) {
      if (char === '"' || char === "'" || char === '`') { quote = char; continue }
      if (char === '{') { expressionDepth += 1; continue }
      if (char === '}') { expressionDepth -= 1; continue }
      continue
    }

    if (char === '$' && next === '{') { expressionDepth = 1; index += 1; continue }
    if (char === '`') return index
  }
  return -1
}

function applyEdits(source: string, edits: readonly SourceEdit[]): string {
  let output = ''
  let cursor = 0
  for (const edit of edits) {
    if (edit.start < cursor) continue
    output += source.slice(cursor, edit.start)
    output += edit.value
    cursor = edit.end
  }
  return output + source.slice(cursor)
}

function ensureCompiledImport(source: string, importPath: string): string {
  const needed = ['createCompiledElement', 'createCompiledTemplate']
  const hasElement = /import\s+\{[^}]*\bcreateCompiledElement\b[^}]*\}\s+from\s+['"][^'"]+['"]/.test(source)
  const hasTemplate = /import\s+\{[^}]*\bcreateCompiledTemplate\b[^}]*\}\s+from\s+['"][^'"]+['"]/.test(source)
  if (hasElement && hasTemplate) return source
  return `import { ${needed.join(', ')} } from ${JSON.stringify(importPath)};\n${source}`
}
