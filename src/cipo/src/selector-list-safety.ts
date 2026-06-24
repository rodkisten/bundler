/**
 * Repairs multiline nested selector lists after runtime DSL expansion.
 *
 * @remarks
 * Semicolon-free selector lists may span multiple lines. The scanner joins only
 * a line ending in a comma with a following line that starts with the nesting
 * marker, preserving unrelated line breaks and declaration boundaries. It also
 * removes whitespace introduced between the nesting marker and a pseudo selector.
 *
 * @param input - Transformed CSS that may contain multiline nested selectors.
 * @returns CSS with selector continuations and pseudo-selector spacing normalized.
 */
export function joinNestedSelectorLists(input: string): string {
  const lines = input.split(/\r?\n/)
  const output: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index] || ''

    while (line.trimEnd().endsWith(',') && index + 1 < lines.length) {
      const next = lines[index + 1] || ''
      const selector = next.trimStart()
      if (!selector.startsWith('&')) break
      line = `${line.trimEnd()}${selector}`
      index += 1
    }

    output.push(line)
  }

  return output.join('\n').replace(/&:\s+(?=[a-zA-Z_-])/g, '&:')
}
