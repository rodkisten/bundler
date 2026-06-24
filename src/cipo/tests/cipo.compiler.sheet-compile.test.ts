import { beforeEach, describe, expect, it } from 'vitest'
import { reset, setup } from '../src/index'
import { compileSheetCss, compileStylesheetText, shouldCompileAsStylesheet, wrapSheetLayer } from '../src/compiler/sheet-compile'
import { parseStylesheet } from '../src/parser'

describe('Cipó compiler/sheet-compile', () => {
  beforeEach(() => {
    reset()
    setup({ prefix: 'sheetx', minify: true, theme: { colors: { brand: '#f97316' }, spacing: '0.25rem' } })
  })

  it('detects stylesheet roots without loose declarations', () => {
    const ast = parseStylesheet('.card { color: red }', [])
    expect(shouldCompileAsStylesheet('.card { color: red }', '.card { color: red }', ast)).toBe(true)
    expect(shouldCompileAsStylesheet('color:red;', 'color:red;', parseStylesheet('color:red;', []))).toBe(false)
  })

  it('compiles nested stylesheet text', () => {
    const ast = parseStylesheet('.card { color: red; &:hover { color: blue } }', [])
    const output = compileStylesheetText(ast)

    expect(output).toContain('.card{color:red;}')
    expect(output).toContain('.card:hover{color:blue;}')
  })

  it('compiles explicit sheet artifacts and layers', () => {
    const artifact = compileSheetCss([`.card { px: 4; color: $brand }`] as unknown as TemplateStringsArray, [], false)
    const layered = wrapSheetLayer('components', artifact)

    expect(artifact.kind).toBe('cipo.stylesheet')
    expect(String(artifact)).toContain('.card')
    expect(String(layered)).toContain('@layer components')
  })
})
