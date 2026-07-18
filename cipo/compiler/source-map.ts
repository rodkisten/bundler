export interface CipoSourceMap {
  readonly version: 3
  readonly file?: string
  readonly sources: readonly string[]
  readonly sourcesContent: readonly string[]
  readonly names: readonly string[]
  readonly mappings: string
}

/**
 * Builds a lightweight line-level source map for source-to-source compiler
 * transforms. Unchanged lines map exactly; generated helper/import lines map to
 * the closest preceding original line.
 */
export function createLineSourceMap(
  original: string,
  generated: string,
  filename: string,
): CipoSourceMap {
  const originalLines = original.split(/\r?\n/)
  const generatedLines = generated.split(/\r?\n/)
  const positions = indexOriginalLines(originalLines)
  let previousOriginalLine = 0
  let previousSourceIndex = 0
  let previousOriginalColumn = 0
  let mappings = ''

  for (let generatedLine = 0; generatedLine < generatedLines.length; generatedLine += 1) {
    if (generatedLine > 0) mappings += ';'
    const text = generatedLines[generatedLine]!.trim()
    const originalLine = findBestOriginalLine(positions.get(text), previousOriginalLine)
    const resolvedLine = originalLine ?? Math.min(previousOriginalLine, Math.max(0, originalLines.length - 1))

    const segment = [
      0,
      0 - previousSourceIndex,
      resolvedLine - previousOriginalLine,
      0 - previousOriginalColumn,
    ]
    mappings += segment.map(encodeVlq).join('')
    previousSourceIndex = 0
    previousOriginalLine = resolvedLine
    previousOriginalColumn = 0
  }

  return {
    version: 3,
    file: filename,
    sources: [filename],
    sourcesContent: [original],
    names: [],
    mappings,
  }
}

function indexOriginalLines(lines: readonly string[]): Map<string, number[]> {
  const output = new Map<string, number[]>()
  for (let index = 0; index < lines.length; index += 1) {
    const key = lines[index]!.trim()
    if (!key) continue
    const positions = output.get(key)
    if (positions) positions.push(index)
    else output.set(key, [index])
  }
  return output
}

function findBestOriginalLine(candidates: readonly number[] | undefined, previous: number): number | undefined {
  if (!candidates || candidates.length === 0) return undefined
  for (const candidate of candidates) if (candidate >= previous) return candidate
  return candidates.at(-1)
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function encodeVlq(value: number): string {
  let vlq = value < 0 ? ((-value) << 1) | 1 : value << 1
  let output = ''
  do {
    let digit = vlq & 31
    vlq >>>= 5
    if (vlq > 0) digit |= 32
    output += BASE64[digit]!
  } while (vlq > 0)
  return output
}
