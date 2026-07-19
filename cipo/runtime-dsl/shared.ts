/** Returns whether the character at `index` is escaped by an odd backslash run. */
export function isEscapedAt(input: string, index: number): boolean {
  let slashCount = 0

  for (let cursor = index - 1; cursor >= 0 && input[cursor] === '\\'; cursor -= 1) {
    slashCount += 1
  }

  return slashCount % 2 === 1
}

/** Finds a target character that is not nested in CSS/DSL brackets, comments, or quoted text. */
export function findTopLevelChar(value: string, target: string): number {
  const stack: string[] = []
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? ''
    const next = value[index + 1] ?? ''

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (char === quote && !isEscapedAt(value, index)) quote = null
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (stack.length === 0 && char === target) return index

    const expectedClose = closingDelimiterFor(char)
    if (expectedClose) {
      stack.push(expectedClose)
      continue
    }

    if (isClosingDelimiter(char) && stack.at(-1) === char) stack.pop()
  }

  return -1
}

/** Finds the matching delimiter while preserving nested delimiter families and opaque CSS text. */
export function findMatching(
  input: string,
  openIndex: number,
  openChar: string,
  closeChar: string,
): number {
  if (input[openIndex] !== openChar) return -1

  const stack: string[] = [closeChar]
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = openIndex + 1; index < input.length; index += 1) {
    const char = input[index] ?? ''
    const next = input[index + 1] ?? ''

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (char === quote && !isEscapedAt(input, index)) quote = null
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    const expectedClose = closingDelimiterFor(char)
    if (expectedClose) {
      stack.push(expectedClose)
      continue
    }

    if (!isClosingDelimiter(char) || stack.at(-1) !== char) continue

    stack.pop()
    if (stack.length === 0) return index
  }

  return -1
}

export function readIdentifierEnd(input: string, start: number): number {
  let index = start
  while (index < input.length && isIdentifierPart(input[index] ?? '')) index += 1
  return index
}

export function skipSpaces(input: string, start: number): number {
  let index = start
  while (index < input.length && /\s/.test(input[index] ?? '')) index += 1
  return index
}

export function isIdentifierStart(value: string): boolean {
  return /^[a-zA-Z_]$/.test(value)
}

export function isIdentifierPart(value: string): boolean {
  return /^[a-zA-Z0-9_.-]$/.test(value)
}

/**
 * Parameter names use identifier characters, but a hyphen intentionally ends a parameter reference.
 * This keeps `$gap-sm` interpretable as the `$gap` parameter followed by the CSS `-sm` suffix.
 */
export function isParamBoundary(value: string): boolean {
  return !value || !/^[a-zA-Z0-9_.]$/.test(value)
}

function closingDelimiterFor(char: string): string | undefined {
  if (char === '(') return ')'
  if (char === '[') return ']'
  if (char === '{') return '}'
  return undefined
}

function isClosingDelimiter(char: string): boolean {
  return char === ')' || char === ']' || char === '}'
}
