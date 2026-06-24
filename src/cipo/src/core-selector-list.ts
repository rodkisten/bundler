export function normalizeCoreSelectorLists(input: string): string {
  const lines = input.split(/\r?\n/)
  const output: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index] || ''
    while (line.trimEnd().endsWith(',') && index + 1 < lines.length) {
      const selector = (lines[index + 1] || '').trimStart()
      if (!selector.startsWith('&')) break
      line = `${line.trimEnd()}${selector}`
      index += 1
    }
    output.push(line)
  }

  return output.join('\n').replace(/&:\s+(?=[a-zA-Z_-])/g, '&:')
}
