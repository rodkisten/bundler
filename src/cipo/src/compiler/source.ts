export interface SourceEdit { readonly start: number; readonly end: number; readonly value: string }
export interface StyledCssTemplateHit { readonly start: number; readonly receiver: string; readonly templateStart: number; readonly templateEnd: number }
export interface CssTemplateHit { readonly start: number; readonly templateStart: number; readonly templateEnd: number }

/** Shared source-level scanner used by Cipó build and inline transforms. */
export function findStyledCssTemplates(source: string): StyledCssTemplateHit[] {
  const hits: StyledCssTemplateHit[] = []
  const marker = '.css`'
  let searchFrom = 0
  while (searchFrom < source.length) {
    const markerIndex = source.indexOf(marker, searchFrom)
    if (markerIndex < 0) break
    if (isInsideIgnoredSourceRange(source, markerIndex)) {
      searchFrom = markerIndex + marker.length
      continue
    }
    const receiverStart = findReceiverStart(source, markerIndex)
    const templateStart = markerIndex + '.css'.length
    const templateEnd = findTemplateEnd(source, templateStart)
    if (receiverStart >= 0 && templateEnd >= 0) {
      const receiver = source.slice(receiverStart, markerIndex)
      if (isCompilableReceiver(receiver)) {
        hits.push({ start: receiverStart, receiver, templateStart, templateEnd })
        searchFrom = templateEnd + 1
        continue
      }
    }
    searchFrom = markerIndex + marker.length
  }
  return hits
}

export function findBareCssTemplates(source: string, existingEdits: readonly SourceEdit[] = []): CssTemplateHit[] {
  const hits: CssTemplateHit[] = []
  const marker = 'css`'
  let searchFrom = 0
  while (searchFrom < source.length) {
    const start = source.indexOf(marker, searchFrom)
    if (start < 0) break
    const before = source[start - 1] ?? ''
    if (isInsideIgnoredSourceRange(source, start) || /[$\w.]/.test(before) || overlapsAny(start, start + marker.length, existingEdits)) {
      searchFrom = start + marker.length
      continue
    }
    const templateStart = start + 'css'.length
    const templateEnd = findTemplateEnd(source, templateStart)
    if (templateEnd >= 0) hits.push({ start, templateStart, templateEnd })
    searchFrom = templateEnd >= 0 ? templateEnd + 1 : start + marker.length
  }
  return hits
}

export function hasTemplateInterpolation(source: string, templateStart: number, templateEnd: number): boolean {
  let escaped = false
  for (let index = templateStart + 1; index < templateEnd; index += 1) {
    const char = source[index]
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (char === '$' && source[index + 1] === '{') return true
  }
  return false
}

export function applyEdits(source: string, edits: readonly SourceEdit[]): string {
  let output = ''
  let cursor = 0
  for (const edit of edits) {
    if (edit.start < cursor) continue
    output += source.slice(cursor, edit.start)
    output += edit.value
    cursor = edit.end
  }
  output += source.slice(cursor)
  return output
}

export function ensureNamedImport(source: string, symbol: string, importPath: string): string {
  const re = new RegExp(`import\\s+\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s+from\\s+['\"][^'\"]+['\"]`)
  if (re.test(source)) return source
  return `import { ${symbol} } from '${importPath}'\n${source}`
}

function overlapsAny(start: number, end: number, edits: readonly SourceEdit[]): boolean {
  return edits.some((edit) => start < edit.end && end > edit.start)
}


function isInsideIgnoredSourceRange(source: string, position: number): boolean {
  let quote = ''
  let lineComment = false
  let blockComment = false
  let escaped = false

  for (let index = 0; index < position; index += 1) {
    const char = source[index]!
    const next = source[index + 1]

    if (lineComment) {
      if (char === '\n' || char === '\r') lineComment = false
      continue
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }

    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }

    if (char === '"' || char === "'" || char === '`') quote = char
  }

  return Boolean(quote || lineComment || blockComment)
}

function findReceiverStart(source: string, cssDotIndex: number): number {
  let index = cssDotIndex - 1
  let parenDepth = 0
  let bracketDepth = 0
  let quote = ''
  let escaped = false
  for (; index >= 0; index -= 1) {
    const char = source[index]!
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue }
    if (char === ')') { parenDepth += 1; continue }
    if (char === '(') { parenDepth -= 1; continue }
    if (char === ']') { bracketDepth += 1; continue }
    if (char === '[') { bracketDepth -= 1; continue }
    if (parenDepth < 0 || bracketDepth < 0) return index + 1
    if (parenDepth === 0 && bracketDepth === 0 && !isReceiverChar(char)) return index + 1
  }
  return 0
}

function isReceiverChar(char: string): boolean {
  return /[A-Za-z0-9_$.[\]()'",\s:-]/.test(char)
}

function isCompilableReceiver(receiver: string): boolean {
  const compact = receiver.replace(/\s+/g, '')
  if (compact === 'sheet') return true
  return /^(?:styled|cipo)(?:\.[A-Za-z_$][\w$]*|\(|\[)/.test(compact)
}

export function findTemplateEnd(source: string, start: number): number {
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
