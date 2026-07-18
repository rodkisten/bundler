import { describe, expect, it } from 'vitest'
import { createLineSourceMap } from './source-map'
describe('createLineSourceMap', () => {
  it('creates a valid Source Map v3 contract with the original source embedded', () => {
    const original = [
      'const first = 1',
      'const second = 2',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      original,
      original,
      '/src/example.ts',
    )
    expect(sourceMap).toEqual({
      version: 3,
      file: '/src/example.ts',
      sources: ['/src/example.ts'],
      sourcesContent: [original],
      names: [],
      mappings: expect.any(String),
    })
    expect(sourceMap.mappings).not.toBe('')
  })
  it('maps unchanged generated lines exactly to their original source lines', () => {
    const source = [
      'const first = 1',
      'const second = 2',
      'const third = 3',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      source,
      source,
      '/src/example.ts',
    )
    expect(
      decodeOriginalLineMappings(
        sourceMap.mappings,
      ),
    ).toEqual([
      0,
      1,
      2,
    ])
  })
  it('maps a generated import inserted at the beginning to the first original line', () => {
    const original = [
      'const Button = styled.button("Button")',
      'export { Button }',
    ].join('\n')
    const generated = [
      'import { helper } from "@rodkisten/cipo/compiler";',
      'const Button = styled.button("Button")',
      'export { Button }',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      original,
      generated,
      '/src/button.ts',
    )
    expect(
      decodeOriginalLineMappings(
        sourceMap.mappings,
      ),
    ).toEqual([
      0,
      0,
      1,
    ])
  })
  it('maps generated helper lines to the closest previously resolved original line', () => {
    const original = [
      'const first = 1',
      'const second = 2',
      'const third = 3',
    ].join('\n')
    const generated = [
      'const first = 1',
      '__generatedHelper()',
      '__anotherGeneratedHelper()',
      'const second = 2',
      'const third = 3',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      original,
      generated,
      '/src/example.ts',
    )
    expect(
      decodeOriginalLineMappings(
        sourceMap.mappings,
      ),
    ).toEqual([
      0,
      0,
      0,
      1,
      2,
    ])
  })
  it('maps a generated line inserted between original lines to the preceding original line', () => {
    const original = [
      'const first = 1',
      'const second = 2',
    ].join('\n')
    const generated = [
      'const first = 1',
      'const generated = compile(first)',
      'const second = 2',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      original,
      generated,
      '/src/example.ts',
    )
    expect(
      decodeOriginalLineMappings(
        sourceMap.mappings,
      ),
    ).toEqual([
      0,
      0,
      1,
    ])
  })
  it('matches lines independently of indentation differences', () => {
    const original = [
      'function example() {',
      '  const value = 42',
      '}',
    ].join('\n')
    const generated = [
      'function example() {',
      '        const value = 42',
      '}',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      original,
      generated,
      '/src/example.ts',
    )
    expect(
      decodeOriginalLineMappings(
        sourceMap.mappings,
      ),
    ).toEqual([
      0,
      1,
      2,
    ])
  })
  it('maps repeated identical source lines to successive original occurrences', () => {
    const original = [
      'const value = createValue()',
      'const separator = true',
      'const value = createValue()',
    ].join('\n')
    const generated = [
      'const value = createValue()',
      'const separator = true',
      'const value = createValue()',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      original,
      generated,
      '/src/example.ts',
    )
    expect(
      decodeOriginalLineMappings(
        sourceMap.mappings,
      ),
    ).toEqual([
      0,
      1,
      2,
    ])
  })
  it('uses the next matching duplicate occurrence at or after the current original position', () => {
    const original = [
      'repeat()',
      'first()',
      'repeat()',
      'second()',
      'repeat()',
    ].join('\n')
    const generated = [
      'repeat()',
      'first()',
      'repeat()',
      'second()',
      'repeat()',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      original,
      generated,
      '/src/repeated.ts',
    )
    expect(
      decodeOriginalLineMappings(
        sourceMap.mappings,
      ),
    ).toEqual([
      0,
      1,
      2,
      3,
      4,
    ])
  })
  it('keeps blank generated lines anchored to the previous original line', () => {
    const original = [
      'const first = 1',
      '',
      'const second = 2',
    ].join('\n')
    const generated = [
      'const first = 1',
      '',
      '',
      'const second = 2',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      original,
      generated,
      '/src/example.ts',
    )
    expect(
      decodeOriginalLineMappings(
        sourceMap.mappings,
      ),
    ).toEqual([
      0,
      0,
      0,
      2,
    ])
  })
  it('supports CRLF original and generated sources', () => {
    const original = [
      'const first = 1',
      'const second = 2',
      'const third = 3',
    ].join('\r\n')
    const generated = [
      'const first = 1',
      'const second = 2',
      'const third = 3',
    ].join('\r\n')
    const sourceMap = createLineSourceMap(
      original,
      generated,
      'C:\\project\\example.ts',
    )
    expect(
      decodeOriginalLineMappings(
        sourceMap.mappings,
      ),
    ).toEqual([
      0,
      1,
      2,
    ])
    expect(sourceMap.file).toBe(
      'C:\\project\\example.ts',
    )
    expect(sourceMap.sourcesContent).toEqual([
      original,
    ])
  })
  it('emits exactly one mapping segment for every generated line', () => {
    const original = [
      'first()',
      'second()',
    ].join('\n')
    const generated = [
      'import "generated"',
      'first()',
      '',
      'generatedHelper()',
      'second()',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      original,
      generated,
      '/src/example.ts',
    )
    const mappingLines =
      sourceMap.mappings.split(';')
    expect(mappingLines).toHaveLength(5)
    for (const mapping of mappingLines) {
      expect(mapping).not.toBe('')
      expect(
        decodeVlqSegment(mapping),
      ).toHaveLength(4)
    }
  })
  it('always emits generated column zero, source index zero, and original column zero', () => {
    const original = [
      'const first = 1',
      'const second = 2',
    ].join('\n')
    const generated = [
      'generated()',
      'const first = 1',
      'const second = 2',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      original,
      generated,
      '/src/example.ts',
    )
    const decoded =
      decodeMappings(
        sourceMap.mappings,
      )
    expect(
      decoded.map(
        (mapping) =>
          mapping.generatedColumn,
      ),
    ).toEqual([
      0,
      0,
      0,
    ])
    expect(
      decoded.map(
        (mapping) =>
          mapping.sourceIndex,
      ),
    ).toEqual([
      0,
      0,
      0,
    ])
    expect(
      decoded.map(
        (mapping) =>
          mapping.originalColumn,
      ),
    ).toEqual([
      0,
      0,
      0,
    ])
  })
  it('handles a completely generated source when no generated line matches the original source', () => {
    const original = [
      'const original = true',
      'export { original }',
    ].join('\n')
    const generated = [
      'const generated = true',
      'generatedHelper()',
      'export { generated }',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      original,
      generated,
      '/src/generated.ts',
    )
    expect(
      decodeOriginalLineMappings(
        sourceMap.mappings,
      ),
    ).toEqual([
      0,
      0,
      0,
    ])
  })
  it('handles empty source content without producing invalid mappings', () => {
    const sourceMap = createLineSourceMap(
      '',
      '',
      '/src/empty.ts',
    )
    expect(sourceMap).toEqual({
      version: 3,
      file: '/src/empty.ts',
      sources: ['/src/empty.ts'],
      sourcesContent: [''],
      names: [],
      mappings: expect.any(String),
    })
    expect(
      decodeOriginalLineMappings(
        sourceMap.mappings,
      ),
    ).toEqual([
      0,
    ])
  })
  it('anchors generated content to line zero when the original source is empty', () => {
    const generated = [
      'import "generated"',
      'generatedHelper()',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      '',
      generated,
      '/src/empty.ts',
    )
    expect(
      decodeOriginalLineMappings(
        sourceMap.mappings,
      ),
    ).toEqual([
      0,
      0,
    ])
  })
  it('preserves Unicode source content exactly in sourcesContent', () => {
    const original = [
      '// Cipó 🌿',
      'const mensagem = "olá"',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      original,
      original,
      '/src/cipó.ts',
    )
    expect(sourceMap.sourcesContent).toEqual([
      original,
    ])
    expect(
      decodeOriginalLineMappings(
        sourceMap.mappings,
      ),
    ).toEqual([
      0,
      1,
    ])
  })
  it('produces deterministic source maps for identical inputs', () => {
    const original = [
      'const first = 1',
      'const second = 2',
    ].join('\n')
    const generated = [
      'import "generated"',
      'const first = 1',
      'const second = 2',
    ].join('\n')
    const first = createLineSourceMap(
      original,
      generated,
      '/src/example.ts',
    )
    const second = createLineSourceMap(
      original,
      generated,
      '/src/example.ts',
    )
    expect(second).toEqual(first)
  })
  it('encodes negative original-line deltas as valid VLQ segments', () => {
    const original = [
      'repeat()',
      'middle()',
      'final()',
    ].join('\n')
    const generated = [
      'final()',
      'repeat()',
    ].join('\n')
    const sourceMap = createLineSourceMap(
      original,
      generated,
      '/src/reordered.ts',
    )
    const mappings =
      decodeMappings(
        sourceMap.mappings,
      )
    expect(
      mappings.map(
        (mapping) =>
          mapping.originalLine,
      ),
    ).toEqual([
      2,
      0,
    ])
    // This also exercises VLQ signed decoding because the second segment
    // carries an original-line delta of -2.
    expect(
      decodeVlqSegment(
        sourceMap.mappings.split(';')[1]!,
      )[2],
    ).toBe(-2)
  })
})
interface DecodedMapping {
  readonly generatedLine: number
  readonly generatedColumn: number
  readonly sourceIndex: number
  readonly originalLine: number
  readonly originalColumn: number
}
/**
 * Decodes the subset of Source Map v3 generated by createLineSourceMap().
 *
 * The production implementation intentionally emits one four-field segment
 * per generated line, so this helper lets tests validate semantic mappings
 * instead of coupling assertions to opaque Base64 VLQ strings.
 */
function decodeMappings(
  mappings: string,
): DecodedMapping[] {
  const output: DecodedMapping[] = []
  let previousSourceIndex = 0
  let previousOriginalLine = 0
  let previousOriginalColumn = 0
  const lines = mappings.split(';')
  for (
    let generatedLine = 0;
    generatedLine < lines.length;
    generatedLine += 1
  ) {
    const encoded =
      lines[generatedLine]!
    if (!encoded) {
      continue
    }
    const segment =
      decodeVlqSegment(encoded)
    expect(segment).toHaveLength(4)
    const [
      generatedColumnDelta,
      sourceIndexDelta,
      originalLineDelta,
      originalColumnDelta,
    ] = segment
    const sourceIndex =
      previousSourceIndex
      + sourceIndexDelta!
    const originalLine =
      previousOriginalLine
      + originalLineDelta!
    const originalColumn =
      previousOriginalColumn
      + originalColumnDelta!
    output.push({
      generatedLine,
      generatedColumn:
        generatedColumnDelta!,
      sourceIndex,
      originalLine,
      originalColumn,
    })
    previousSourceIndex =
      sourceIndex
    previousOriginalLine =
      originalLine
    previousOriginalColumn =
      originalColumn
  }
  return output
}
function decodeOriginalLineMappings(
  mappings: string,
): number[] {
  return decodeMappings(
    mappings,
  ).map(
    (mapping) =>
      mapping.originalLine,
  )
}
function decodeVlqSegment(
  encoded: string,
): number[] {
  const values: number[] = []
  let index = 0
  while (index < encoded.length) {
    let value = 0
    let shift = 0
    let continuation = true
    while (continuation) {
      const character =
        encoded[index]
      if (character === undefined) {
        throw new Error(
          'Unexpected end of Base64 VLQ segment.',
        )
      }
      const digit =
        BASE64.indexOf(character)
      if (digit === -1) {
        throw new Error(
          `Invalid Base64 VLQ character: ${JSON.stringify(character)}.`,
        )
      }
      index += 1
      continuation =
        (digit & 32) !== 0
      value +=
        (digit & 31) << shift
      shift += 5
    }
    const negative =
      (value & 1) === 1
    const magnitude =
      value >>> 1
    values.push(
      negative
        ? -magnitude
        : magnitude,
    )
  }
  return values
}
const BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
