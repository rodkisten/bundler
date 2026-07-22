import { beforeEach, describe, expect, it } from 'vitest'
import { reset, setup } from '@rodkisten/cipo'
import {
  compileSheetCss,
  compileStylesheetText,
  shouldCompileAsStylesheet,
  wrapSheetLayer,
} from '@rodkisten/cipo/compiler'
import { parseStylesheet } from '../syntax/parser'

describe('Cipó compiler/sheet-compile', () => {
  beforeEach(() => {
    reset()
    setup({
      prefix: 'sheetx',
      minify: true,
      theme: {
        colors: { brand: '#f97316' },
        spacing: '0.25rem',
      },
    })
  })

  it('detects stylesheet roots without loose declarations', () => {
    const ast = parseStylesheet('.card { color: red }', [])
    expect(
      shouldCompileAsStylesheet(
        '.card { color: red }',
        '.card { color: red }',
        ast,
      ),
    ).toBe(true)
    expect(
      shouldCompileAsStylesheet(
        'color:red;',
        'color:red;',
        parseStylesheet('color:red;', []),
      ),
    ).toBe(false)
  })

  it('compiles nested stylesheet text', () => {
    const ast = parseStylesheet(
      '.card { color: red; &:hover { color: blue } }',
      [],
    )
    const output = compileStylesheetText(ast)

    expect(output).toContain('.card{color:red}')
    expect(output).toContain('.card:hover{color:blue}')
  })

  it('compiles explicit sheet artifacts and layers', () => {
    const artifact = compileSheetCss(
      [`.card { px: 4; color: $brand }`] as unknown as TemplateStringsArray,
      [],
      false,
    )
    const layered = wrapSheetLayer('components', artifact)

    expect(artifact.kind).toBe('cipo.stylesheet')
    expect(String(artifact)).toContain('.card')
    expect(String(layered)).toContain('@layer components')
  })

  it(
    'preserves :host universal pseudo-element selectors around native CSS math',
    () => {
      const artifact = compileSheetCss([
        `
          :host {
            --rd-safe-bottom: max(
              env(safe-area-inset-bottom, 0px),
              10px
            );
          }

          :host *,
          :host *::before,
          :host *::after {
            box-sizing: border-box;
            width: calc(100% - env(safe-area-inset-left, 0px));
          }
        `,
      ] as unknown as TemplateStringsArray, [], false)
      const output = String(artifact)

      expect(output).toContain(':host *,:host *::before,:host *::after{')
      expect(output).toContain('--rd-safe-bottom:max(')
      expect(output).toContain('env(safe-area-inset-bottom')
      expect(output).toContain('width:calc(100% - env(safe-area-inset-left')
      expect(output).not.toContain(':calc(host *)')
      expect(output).not.toContain(':calc(host *):before')
    },
  )
  it('compiles Fábrica state selector shorthands in stylesheets', () => {
    const ast = parseStylesheet(
      [
        '.editor {',
        "  & :token='comment' { color: red }",
        '  &?disabled { opacity: 0.5 }',
        '}',
      ].join('\n'),
      [],
    )
    const output = compileStylesheetText(ast)
    expect(output).toContain(
      '.editor [data-token="comment"]',
    )
    expect(output).toContain('.editor[disabled]')
  })

})
