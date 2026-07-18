import { describe, expect, it } from 'vitest'
import type { SourceEdit } from './edits'
import {
  findBareCssTemplates,
  findStyledCssTemplates,
  hasTemplateInterpolation,
} from './templates'
describe('compiler source template analysis', () => {
  describe('findStyledCssTemplates', () => {
    it('finds an unbound styled component css tagged template', () => {
      const source = `
        const Button = styled.button('Button').css\`
          color: red;
        \`
      `
      const hits = findStyledCssTemplates(
        source,
        '/src/button.ts',
      )
      expect(hits).toHaveLength(1)
      const [hit] = hits
      expect(hit.receiver).toBe(
        "styled.button('Button')",
      )
      expect(
        source.slice(
          hit.start,
          hit.templateEnd + 1,
        ),
      ).toContain(
        "styled.button('Button').css`",
      )
      expect(
        source.slice(
          hit.templateStart,
          hit.templateEnd + 1,
        ),
      ).toBe(`
          color: red;
        \``)
    })
    it('finds styled imported directly from the Cipó package', () => {
      const source = `
        import { styled } from '@rodkisten/cipo'
        const Button = styled.button('Button').css\`
          color: red;
        \`
      `
      const hits = findStyledCssTemplates(
        source,
        '/src/button.ts',
      )
      expect(hits).toHaveLength(1)
      expect(hits[0].receiver).toBe(
        "styled.button('Button')",
      )
    })
    it('finds an aliased styled import by its exported Cipó identity', () => {
      const source = `
        import {
          styled as ui,
        } from '@rodkisten/cipo'
        const Button = ui.button('Button').css\`
          color: red;
        \`
      `
      const hits = findStyledCssTemplates(
        source,
        '/src/button.ts',
      )
      expect(hits).toHaveLength(1)
      expect(hits[0].receiver).toBe(
        "ui.button('Button')",
      )
    })
    it.each([
      ['cipo', 'cipo'],
      ['sheet', 'sheet'],
    ])(
      'accepts the unbound %s styled root',
      (_name, root) => {
        const source = `
          const Component = ${root}.div('Component').css\`
            color: red;
          \`
        `
        const hits =
          findStyledCssTemplates(source)
        expect(hits).toHaveLength(1)
        expect(hits[0].receiver).toBe(
          `${root}.div('Component')`,
        )
      },
    )
    it('finds a factory created from an imported createStyled binding', () => {
      const source = `
        import {
          createStyled,
        } from '@rodkisten/cipo'
        const appStyled = createStyled({
          prefix: 'app',
        })
        const Button = appStyled.button('Button').css\`
          color: red;
        \`
      `
      const hits = findStyledCssTemplates(
        source,
        '/src/button.ts',
      )
      expect(hits).toHaveLength(1)
      expect(hits[0].receiver).toBe(
        "appStyled.button('Button')",
      )
    })
    it('finds a factory created from an aliased createStyled import', () => {
      const source = `
        import {
          createStyled as createAppStyled,
        } from '@rodkisten/cipo'
        const ui = createAppStyled()
        const Card = ui.div('Card').css\`
          padding: 16px;
        \`
      `
      const hits = findStyledCssTemplates(
        source,
        '/src/card.ts',
      )
      expect(hits).toHaveLength(1)
      expect(hits[0].receiver).toBe(
        "ui.div('Card')",
      )
    })
    it('supports property, call and element-access chains while resolving the original styled root', () => {
      const source = `
        import { styled } from '@rodkisten/cipo'
        const Component = styled['section']('Panel')
          .attrs({ role: 'region' })
          .css\`
            display: block;
          \`
      `
      const hits = findStyledCssTemplates(
        source,
        '/src/panel.ts',
      )
      expect(hits).toHaveLength(1)
      expect(
        hits[0].receiver.replace(/\s+/g, ' '),
      ).toContain(
        "styled['section']('Panel')",
      )
      expect(
        hits[0].receiver,
      ).toContain('.attrs')
    })
    it('finds multiple styled templates in source order', () => {
      const source = `
        const Third = styled.div('Third').css\`
          order: 3;
        \`
        const First = styled.div('First').css\`
          order: 1;
        \`
        const Second = styled.div('Second').css\`
          order: 2;
        \`
      `
      const hits =
        findStyledCssTemplates(source)
      expect(hits).toHaveLength(3)
      expect(
        hits.map((hit) => hit.receiver),
      ).toEqual([
        "styled.div('Third')",
        "styled.div('First')",
        "styled.div('Second')",
      ])
      expect(hits[0].start).toBeLessThan(
        hits[1].start,
      )
      expect(hits[1].start).toBeLessThan(
        hits[2].start,
      )
    })
    it('preserves exact receiver source text', () => {
      const source = `
        const Button =
          styled
            .button(
              'Button',
            )
            .attrs({
              role: 'button',
            })
            .css\`
              color: red;
            \`
      `
      const hits =
        findStyledCssTemplates(source)
      expect(hits).toHaveLength(1)
      expect(hits[0].receiver).toContain(
        'styled',
      )
      expect(hits[0].receiver).toContain(
        '.button',
      )
      expect(hits[0].receiver).toContain(
        '.attrs',
      )
    })
    it('includes only the receiver start and template boundaries in the reported source range', () => {
      const source = `
        const Button = styled.button('Button').css\`
          color: red;
        \`
      `
      const [hit] =
        findStyledCssTemplates(source)
      expect(
        source.slice(
          hit.start,
          hit.templateStart,
        ),
      ).toBe(
        "styled.button('Button').css",
      )
      expect(
        source[hit.templateStart],
      ).toBe('`')
      expect(
        source[hit.templateEnd],
      ).toBe('`')
    })
    it('rejects a styled import from an unrelated package', () => {
      const source = `
        import {
          styled,
        } from '@unrelated/styled'
        const Button = styled.button('Button').css\`
          color: red;
        \`
      `
      expect(
        findStyledCssTemplates(source),
      ).toEqual([])
    })
    it('rejects an aliased unrelated styled import', () => {
      const source = `
        import {
          styled as ui,
        } from '@unrelated/styled'
        const Button = ui.button('Button').css\`
          color: red;
        \`
      `
      expect(
        findStyledCssTemplates(source),
      ).toEqual([])
    })
    it('rejects a locally shadowed styled binding', () => {
      const source = `
        import {
          styled,
        } from '@rodkisten/cipo'
        const Global = styled.div('Global').css\`
          color: red;
        \`
        function createLocalComponent(
          styled: {
            div(name: string): {
              css: unknown
            }
          },
        ) {
          return styled.div('Local').css\`
            color: blue;
          \`
        }
      `
      const hits =
        findStyledCssTemplates(source)
      expect(hits).toHaveLength(1)
      expect(hits[0].receiver).toBe(
        "styled.div('Global')",
      )
      expect(
        hits[0].rawCss,
      ).toBeUndefined()
    })
    it('rejects a factory created from an unrelated createStyled import', () => {
      const source = `
        import {
          createStyled,
        } from '@unrelated/styled'
        const ui = createStyled()
        const Button = ui.button('Button').css\`
          color: red;
        \`
      `
      expect(
        findStyledCssTemplates(source),
      ).toEqual([])
    })
    it('does not treat an unbound createStyled call as a trusted Cipó factory', () => {
      const source = `
        const ui = createStyled()
        const Button = ui.button('Button').css\`
          color: red;
        \`
      `
      expect(
        findStyledCssTemplates(source),
      ).toEqual([])
    })
    it('rejects type-only styled imports', () => {
      const source = `
        import type {
          styled,
        } from '@rodkisten/cipo'
        const Button = styled.button('Button').css\`
          color: red;
        \`
      `
      expect(
        findStyledCssTemplates(source),
      ).toEqual([])
    })
    it('rejects individual type-only styled import specifiers', () => {
      const source = `
        import {
          type styled,
          css,
        } from '@rodkisten/cipo'
        const Button = styled.button('Button').css\`
          color: red;
        \`
      `
      expect(
        findStyledCssTemplates(source),
      ).toEqual([])
    })
    it('ignores ordinary css properties that are not tagged templates', () => {
      const source = `
        const Button = styled.button('Button')
        Button.css({
          color: 'red',
        })
        const value = Button.css
      `
      expect(
        findStyledCssTemplates(source),
      ).toEqual([])
    })
    it('ignores css tagged templates whose receiver has no compilable styled root', () => {
      const source = `
        const component = createSomethingElse()
        const result = component.button('Button').css\`
          color: red;
        \`
      `
      expect(
        findStyledCssTemplates(source),
      ).toEqual([])
    })
    it('ignores styled-like syntax inside comments and strings', () => {
      const source = [
        'const example = "styled.div(\'Fake\').css`color:red;`"',
        '',
        '// styled.div("Comment").css`color:blue;`',
        '',
        '/*',
        '  styled.div("Block").css`color:green;`',
        '*/',
      ].join('\n')
      expect(
        findStyledCssTemplates(source),
      ).toEqual([])
    })
  })
  describe('findBareCssTemplates', () => {
    it('finds an unbound bare css tagged template', () => {
      const source = `
        const className = css\`
          color: red;
        \`
      `
      const hits =
        findBareCssTemplates(source)
      expect(hits).toHaveLength(1)
      const [hit] = hits
      expect(
        source.slice(
          hit.start,
          hit.templateEnd + 1,
        ),
      ).toContain('css`')
      expect(
        source[hit.templateStart],
      ).toBe('`')
      expect(
        source[hit.templateEnd],
      ).toBe('`')
    })
    it('finds css imported from the Cipó package', () => {
      const source = `
        import {
          css,
        } from '@rodkisten/cipo'
        const className = css\`
          display: block;
        \`
      `
      expect(
        findBareCssTemplates(source),
      ).toHaveLength(1)
    })
    it('finds an aliased Cipó css import', () => {
      const source = `
        import {
          css as sx,
        } from '@rodkisten/cipo'
        const className = sx\`
          display: block;
        \`
      `
      const hits =
        findBareCssTemplates(source)
      expect(hits).toHaveLength(1)
      expect(
        source.slice(
          hits[0].start,
          hits[0].templateStart,
        ),
      ).toBe('sx')
    })
    it('rejects css imported from another package', () => {
      const source = `
        import {
          css,
        } from '@emotion/css'
        const className = css\`
          color: red;
        \`
      `
      expect(
        findBareCssTemplates(source),
      ).toEqual([])
    })
    it('rejects a locally shadowed css parameter', () => {
      const source = `
        import {
          css,
        } from '@rodkisten/cipo'
        const globalClass = css\`
          color: red;
        \`
        function run(
          css: (
            strings: TemplateStringsArray,
          ) => string,
        ) {
          return css\`
            color: blue;
          \`
        }
      `
      const hits =
        findBareCssTemplates(source)
      expect(hits).toHaveLength(1)
      expect(
        source.slice(
          hits[0].templateStart,
          hits[0].templateEnd + 1,
        ),
      ).toContain(
        'color: red',
      )
    })
    it('rejects a locally shadowed css variable', () => {
      const source = `
        import {
          css,
        } from '@rodkisten/cipo'
        function run() {
          const css = localCss
          return css\`
            color: red;
          \`
        }
      `
      expect(
        findBareCssTemplates(source),
      ).toEqual([])
    })
    it('rejects a type-only css import', () => {
      const source = `
        import type {
          css,
        } from '@rodkisten/cipo'
        const className = css\`
          color: red;
        \`
      `
      expect(
        findBareCssTemplates(source),
      ).toEqual([])
    })
    it('returns hits sorted by source position', () => {
      const source = `
        const first = css\`
          color: red;
        \`
        const second = css\`
          color: blue;
        \`
        const third = css\`
          color: green;
        \`
      `
      const hits =
        findBareCssTemplates(source)
      expect(hits).toHaveLength(3)
      expect(hits[0].start).toBeLessThan(
        hits[1].start,
      )
      expect(hits[1].start).toBeLessThan(
        hits[2].start,
      )
    })
    it('excludes templates whose full tagged-template range overlaps an existing source edit', () => {
      const source = `
        const first = css\`
          color: red;
        \`
        const second = css\`
          color: blue;
        \`
      `
      const initialHits =
        findBareCssTemplates(source)
      expect(initialHits).toHaveLength(2)
      const first = initialHits[0]
      const existingEdits: SourceEdit[] = [
        {
          start: first.start,
          end: first.templateEnd + 1,
          value: 'replacement',
        },
      ]
      const filtered =
        findBareCssTemplates(
          source,
          existingEdits,
        )
      expect(filtered).toHaveLength(1)
      expect(
        source.slice(
          filtered[0].templateStart,
          filtered[0].templateEnd + 1,
        ),
      ).toContain(
        'color: blue',
      )
    })
    it('keeps a template when an existing edit is adjacent but does not overlap it', () => {
      const source =
        'const value = css`color:red;`'
      const [initialHit] =
        findBareCssTemplates(source)
      const editBefore: SourceEdit = {
        start: 0,
        end: initialHit.start,
        value: '',
      }
      const hits =
        findBareCssTemplates(
          source,
          [editBefore],
        )
      expect(hits).toHaveLength(1)
    })
    it('ignores css-like content inside strings and comments', () => {
      const source = [
        'const example = "css`color:red;`"',
        '// css`color:blue;`',
        '/* css`color:green;` */',
      ].join('\n')
      expect(
        findBareCssTemplates(source),
      ).toEqual([])
    })
    it('does not match property-access css tags as bare css templates', () => {
      const source = `
        const result = runtime.css\`
          color: red;
        \`
      `
      expect(
        findBareCssTemplates(source),
      ).toEqual([])
    })
  })
  describe('styled and bare template coordination', () => {
    it('allows styled template edits to suppress nested bare-css false positives through overlap filtering', () => {
      const source = `
        const Button = styled.button('Button').css\`
          color: red;
        \`
      `
      const styledHits =
        findStyledCssTemplates(source)
      expect(styledHits).toHaveLength(1)
      const styledEdit: SourceEdit = {
        start: styledHits[0].start,
        end: styledHits[0].templateEnd + 1,
        value: 'compiled',
      }
      const bareHits =
        findBareCssTemplates(
          source,
          [styledEdit],
        )
      expect(bareHits).toEqual([])
    })
    it('independently discovers a real bare css template next to a styled template', () => {
      const source = `
        const Button = styled.button('Button').css\`
          color: red;
        \`
        const utility = css\`
          display: flex;
        \`
      `
      const styledHits =
        findStyledCssTemplates(source)
      const styledEdits: SourceEdit[] =
        styledHits.map((hit) => ({
          start: hit.start,
          end: hit.templateEnd + 1,
          value: 'compiled',
        }))
      const bareHits =
        findBareCssTemplates(
          source,
          styledEdits,
        )
      expect(styledHits).toHaveLength(1)
      expect(bareHits).toHaveLength(1)
      expect(
        source.slice(
          bareHits[0].templateStart,
          bareHits[0].templateEnd + 1,
        ),
      ).toContain(
        'display: flex',
      )
    })
  })
  describe('hasTemplateInterpolation', () => {
    it('returns false for a static no-substitution template', () => {
      const source = '`color: red;`'
      expect(
        hasTemplateInterpolation(
          source,
          0,
          source.length - 1,
        ),
      ).toBe(false)
    })
    it('returns true for a template containing an interpolation', () => {
      const source =
        '`color: ${color};`'
      expect(
        hasTemplateInterpolation(
          source,
          0,
          source.length - 1,
        ),
      ).toBe(true)
    })
    it('detects multiple interpolations', () => {
      const source =
        '`rgb(${red}, ${green}, ${blue})`'
      expect(
        hasTemplateInterpolation(
          source,
          0,
          source.length - 1,
        ),
      ).toBe(true)
    })
    it('detects a complex nested JavaScript interpolation', () => {
      const source = [
        '`',
        '  color: ${',
        '    condition',
        '      ? `rgb(${red}, ${green}, ${blue})`',
        '      : fallback',
        '  };',
        '`',
      ].join('\n')
      expect(
        hasTemplateInterpolation(
          source,
          0,
          source.length - 1,
        ),
      ).toBe(true)
    })
    it('does not treat an escaped interpolation marker as a real substitution', () => {
      const source =
        String.raw`\`content: "\${notAnInterpolation}";\``
      expect(
        hasTemplateInterpolation(
          source,
          0,
          source.length - 1,
        ),
      ).toBe(false)
    })
    it('does not treat ordinary dollar signs as interpolation', () => {
      const source =
        '`content: "$100";`'
      expect(
        hasTemplateInterpolation(
          source,
          0,
          source.length - 1,
        ),
      ).toBe(false)
    })
    it('works with template offsets inside a larger source file', () => {
      const source = `
        const before = true
        const Button = styled.button('Button').css\`
          color: \${color};
        \`
        const after = true
      `
      const [hit] =
        findStyledCssTemplates(source)
      expect(
        hasTemplateInterpolation(
          source,
          hit.templateStart,
          hit.templateEnd,
        ),
      ).toBe(true)
    })
    it('returns false for a static template found through AST source analysis', () => {
      const source = `
        const Button = styled.button('Button').css\`
          color: red;
          content: "$100";
        \`
      `
      const [hit] =
        findStyledCssTemplates(source)
      expect(
        hasTemplateInterpolation(
          source,
          hit.templateStart,
          hit.templateEnd,
        ),
      ).toBe(false)
    })
  })
  describe('lexical binding regressions', () => {
    it('does not trust a same-named styled import from another package even when Cipó is also imported elsewhere', () => {
      const source = `
        import {
          css,
        } from '@rodkisten/cipo'
        import {
          styled,
        } from '@emotion/styled'
        const Button = styled.button('Button').css\`
          color: red;
        \`
        const utility = css\`
          display: block;
        \`
      `
      expect(
        findStyledCssTemplates(source),
      ).toEqual([])
      expect(
        findBareCssTemplates(source),
      ).toHaveLength(1)
    })
    it('resolves aliased Cipó imports independently by symbol identity', () => {
      const source = `
        import {
          styled as cipoStyled,
          css as cipoCss,
        } from '@rodkisten/cipo'
        const Button = cipoStyled.button('Button').css\`
          color: red;
        \`
        const utility = cipoCss\`
          display: block;
        \`
      `
      expect(
        findStyledCssTemplates(source),
      ).toHaveLength(1)
      expect(
        findBareCssTemplates(source),
      ).toHaveLength(1)
    })
    it('allows an unbound canonical Cipó global but rejects a bound unrelated lookalike', () => {
      const unboundSource = `
        const first = css\`
          color: red;
        \`
      `
      const unrelatedBoundSource = `
        import {
          css,
        } from '@other/css'
        const first = css\`
          color: red;
        \`
      `
      expect(
        findBareCssTemplates(
          unboundSource,
        ),
      ).toHaveLength(1)
      expect(
        findBareCssTemplates(
          unrelatedBoundSource,
        ),
      ).toEqual([])
    })
  })
  describe('known syntax surface', () => {
    it.todo(
      'supports namespace imports such as import * as cipo from "@rodkisten/cipo" when namespace-root authoring becomes part of the public compiler contract',
    )
    it.todo(
      'recognizes styled factories returned through explicitly supported wrapper functions if factory provenance becomes transitive',
    )
  })
})
