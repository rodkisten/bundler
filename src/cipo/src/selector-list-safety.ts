export function joinNestedSelectorLists(input: string): string {
  const lines = input.split(/\r?\n/)
  const output: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index] || ''

    while (line.trimEnd().endsWith(',') && index + 1 < lines.length) {
      const next = lines[index + 1] || ''
      const selector = next.trimStart()
      if (!selector.startsWith('&')) break
      line = `${line.trimEnd()} ${selector}`
      index += 1
    }

    output.push(line)
  }

  return output.join('\n')
}
