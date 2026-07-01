import { appendValue } from './dom'
import { bindEvent } from './events'
import { setPropertyOrAttribute } from './props'
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
}

const DEFAULT_IMPORT_PATH = './compiler'
const HTML_TAGS = ['html']
const JSX_HTML_TAGS = ['jsx.html', 'html.jsx']

/**
 * Creates a DOM element using the same prop/event/children semantics as the
 * runtime template path, but without `<template>.innerHTML` or marker scanning.
 */
export function createCompiledElement(
  tag: string | ((props: FabricaCompiledElementProps) => RenderValue),
  props: FabricaCompiledElementProps | null,
  ...children: readonly RenderValue[]
): RenderValue {
  if (typeof tag === 'function') return tag({ ...(props ?? {}), children })

  const element = document.createElement(tag)
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

/** Applies compiled props and event listeners to an element. */
export function applyCompiledProps(element: Element, props: FabricaCompiledElementProps | null | undefined): void {
  if (!props) return
  for (const [name, value] of Object.entries(props)) {
    if (value == null || value === false) continue
    if (name === 'className') { setPropertyOrAttribute(element, 'class', value); continue }
    if (name === 'style' && isPlainRecord(value)) { applyStyleObject(element as HTMLElement, value); continue }
    if (name.startsWith('on') && typeof value === 'function') {
      bindEvent(element, name.slice(2).toLowerCase(), value as unknown as RenderValue)
      continue
    }
    setPropertyOrAttribute(element, name, value)
  }
}

/**
 * Compiles simple static Fabrica `html`/`jsx.html` templates to
 * `document.createElement` helpers. Complex templates stay on the runtime path.
 */
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
      const compiled = compileTemplateToExpression(raw)
      if (compiled) {
        edits.push({ start, end: templateEnd + 1, value: compiled.expression })
        manifest.push({
          id: `fabrica-compiled-${manifest.length + 1}`,
          ...(options.filename ? { filename: options.filename } : {}),
          start,
          end: templateEnd + 1,
          tag: compiled.rootTag,
          dynamicValues,
        })
      }
      searchFrom = templateEnd + 1
    }
  }

  if (edits.length === 0) return { code: source, changed: false, manifest }
  const code = ensureCompiledImport(applyEdits(source, edits.sort((a, b) => a.start - b.start)), options.importPath ?? DEFAULT_IMPORT_PATH)
  return { code, changed: true, manifest }
}

interface SourceEdit { readonly start: number; readonly end: number; readonly value: string }
interface CompiledTemplateExpression { readonly expression: string; readonly rootTag: string }
interface ParsedNode { type: 'element'; tag: string; props: Record<string, string | true>; children: ParsedChild[] }
type ParsedChild = ParsedNode | { type: 'text'; value: string }

function compileTemplateToExpression(raw: string): CompiledTemplateExpression | null {
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
  const props = parseAttributes(match[2] ?? '')
  if (!props) return null
  return { type: 'element', tag, props, children: [] }
}

function parseAttributes(source: string): Record<string, string | true> | null {
  const props: Record<string, string | true> = {}
  const re = /([:@A-Za-z_][-:@A-Za-z0-9_.]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'>/]+))?/g
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
  if (name === 'class') return 'class'
  if (name.startsWith('@')) return `on${name.slice(1)}`
  return name
}

function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1)
  return value
}

function emitNode(node: ParsedNode): string {
  const props = Object.keys(node.props).length > 0 ? JSON.stringify(node.props) : 'null'
  const children = node.children.map(emitChild)
  return `createCompiledElement(${JSON.stringify(node.tag)}, ${props}${children.length ? `, ${children.join(', ')}` : ''})`
}

function emitChild(child: ParsedChild): string {
  return child.type === 'text' ? JSON.stringify(collapseWhitespace(child.value)) : emitNode(child)
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function applyStyleObject(element: HTMLElement, style: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(style)) {
    if (value == null) continue
    if (name.startsWith('--')) element.style.setProperty(name, String(value))
    else (element.style as unknown as Record<string, unknown>)[name] = value
  }
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
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index]!
    const next = source[index + 1]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (expressionDepth > 0 && (char === '"' || char === "'")) { quote = char; continue }
    if (char === '$' && next === '{') { expressionDepth += 1; index += 1; continue }
    if (char === '}' && expressionDepth > 0) { expressionDepth -= 1; continue }
    if (char === '`' && expressionDepth === 0) return index
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
  if (/import\s+\{[^}]*\bcreateCompiledElement\b[^}]*\}\s+from\s+['"][^'"]+['"]/.test(source)) return source
  return `import { createCompiledElement } from ${JSON.stringify(importPath)};\n${source}`
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && value.constructor === Object
}
