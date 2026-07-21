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

/**
 * Builds a column-aware source map for source-to-source transforms.
 *
 * Exact surviving lines receive mapping anchors across the line instead of a
 * single column-zero segment. Rewritten/generated lines fall back to the
 * closest monotonic source line, which keeps stack traces stable while still
 * allowing debuggers to recover useful columns for untouched source regions.
 *
 * This intentionally remains dependency-free. Compiler stages that own exact
 * edit ranges can layer richer mappings later without forcing runtime packages
 * to depend on a source-map implementation.
 */
export function createTransformSourceMap(
  original: string,
  generated: string,
  filename: string,
): CipoSourceMap {
  const originalLines = original.split(/\r?\n/)
  const generatedLines = generated.split(/\r?\n/)
  const exactPositions = indexExactOriginalLines(originalLines)
  const trimmedPositions = indexOriginalLines(originalLines)
  let previousSourceIndex = 0
  let previousOriginalLine = 0
  let previousOriginalColumn = 0
  let mappings = ''

  for (
    let generatedLine = 0;
    generatedLine < generatedLines.length;
    generatedLine += 1
  ) {
    if (generatedLine > 0) mappings += ';'

    const generatedText = generatedLines[generatedLine] ?? ''
    const exactLine = findBestOriginalLine(
      exactPositions.get(generatedText),
      previousOriginalLine,
    )
    const trimmedLine = findBestOriginalLine(
      trimmedPositions.get(generatedText.trim()),
      previousOriginalLine,
    )
    const resolvedLine =
      exactLine
      ?? trimmedLine
      ?? Math.min(
        previousOriginalLine,
        Math.max(0, originalLines.length - 1),
      )
    const sourceText = originalLines[resolvedLine] ?? ''
    const exact = exactLine !== undefined && sourceText === generatedText
    const columns = exact
      ? createColumnAnchors(generatedText)
      : [0]
    let previousGeneratedColumn = 0

    for (let index = 0; index < columns.length; index += 1) {
      if (index > 0) mappings += ','
      const generatedColumn = columns[index] ?? 0
      const originalColumn = exact
        ? Math.min(generatedColumn, sourceText.length)
        : 0
      const segment = [
        generatedColumn - previousGeneratedColumn,
        0 - previousSourceIndex,
        resolvedLine - previousOriginalLine,
        originalColumn - previousOriginalColumn,
      ]
      mappings += segment.map(encodeVlq).join('')
      previousGeneratedColumn = generatedColumn
      previousSourceIndex = 0
      previousOriginalLine = resolvedLine
      previousOriginalColumn = originalColumn
    }
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

function indexExactOriginalLines(
  lines: readonly string[],
): Map<string, number[]> {
  const output = new Map<string, number[]>()
  for (let index = 0; index < lines.length; index += 1) {
    const key = lines[index] ?? ''
    const positions = output.get(key)
    if (positions) positions.push(index)
    else output.set(key, [index])
  }
  return output
}

function createColumnAnchors(line: string): number[] {
  if (!line) return [0]

  const output = [0]
  const stride = 16
  for (let column = stride; column < line.length; column += stride) {
    output.push(column)
  }
  if (output[output.length - 1] !== line.length) output.push(line.length)
  return output
}
