import {
  applyEdits,
  countTemplateValues,
  findTemplateEnd,
  isTagBoundary,
  isVoidTag,
  normalizeAttributeName,
  type SourceEdit,
  unquote,
} from './compiler-utils'

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

const DEFAULT_IMPORT_PATH = './compiler-runtime'
const HTML_TAGS = ['html']
const JSX_HTML_TAGS = ['jsx.html', 'html.jsx']

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

interface ParsedNode { type: 'element'; tag: string; props: Record<string, string | true>; children: ParsedChild[] }
type ParsedChild = ParsedNode | { type: 'text'; value: string }


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

function ensureCompiledImport(source: string, importPath: string): string {
  const needed = ['createCompiledElement', 'createCompiledTemplate']
  const hasElement = /import\s+\{[^}]*\bcreateCompiledElement\b[^}]*\}\s+from\s+['"][^'"]+['"]/.test(source)
  const hasTemplate = /import\s+\{[^}]*\bcreateCompiledTemplate\b[^}]*\}\s+from\s+['"][^'"]+['"]/.test(source)
  if (hasElement && hasTemplate) return source
  return `import { ${needed.join(', ')} } from ${JSON.stringify(importPath)};\n${source}`
}
