/** Finds a target character that is not nested in CSS/DSL brackets or quoted text. */
export function findTopLevelChar(value: string, target: string): number {
  let depth = 0
  let quote: '"' | "'" | null = null
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quote) {
      if (char === quote && value[index - 1] !== "\\") quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '(' || char === '[' || char === '{') {
      depth += 1
      continue
    }
    if (char === ')' || char === ']' || char === '}') {
      depth = Math.max(0, depth - 1)
      continue
    }
    if (depth === 0 && char === target) return index
  }
  return -1
}

/** Finds the matching delimiter while preserving quoted text. */
export function findMatching(
  input: string,
  openIndex: number,
  openChar: string,
  closeChar: string,
): number {
  if (input[openIndex] !== openChar) return -1
  let depth = 0
  let quote: '"' | "'" | null = null
  for (let index = openIndex; index < input.length; index += 1) {
    const char = input[index]
    if (quote) {
      if (char === quote && input[index - 1] !== "\\") quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === openChar) depth += 1
    else if (char === closeChar) depth -= 1
    if (depth === 0) return index
  }
  return -1
}

export function readIdentifierEnd(input: string, start: number): number {
  let index = start
  while (index < input.length && isIdentifierPart(input[index] || '')) index += 1
  return index
}

export function skipSpaces(input: string, start: number): number {
  let index = start
  while (index < input.length && /\s/.test(input[index] || '')) index += 1
  return index
}

export function isIdentifierStart(value: string): boolean {
  return /[a-zA-Z_]/.test(value)
}

export function isIdentifierPart(value: string): boolean {
  return /[a-zA-Z0-9_.-]/.test(value)
}

export function isParamBoundary(value: string): boolean {
  return !value || !/[a-zA-Z0-9_.]/.test(value)
}
