/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { createCompiledStyled, compileCipoSourceInline, compiledInlineCss, cipoVite, setup } from '../src'
import { createFabrica } from '../../fabrica'

describe('Cipó compiled inline + Vite playground mode', () => {
  it('compiles templates through the existing inline compiler', () => {
    setup({ adapter: 'dom' })
    const artifact = compiledInlineCss`
      color: red;
      padding-left: 8px;
      padding-right: 8px;
    `

    expect(artifact.kind).toBe('cipo.inline-css')
    expect(artifact.cssText).toContain('color:red')
    expect(artifact.cssText).toContain('padding-left')
    expect(artifact.cssText).toContain('padding-right')
  })

  it('creates Fábrica styled components with inline style by default', () => {
    setup({ adapter: 'dom' })
    const fabrica = createFabrica({ name: 'compiled-inline-test', isolated: true })
    const styled = createCompiledStyled({ fabrica })
    const Card = styled.div('Card').css`
      color: red;
      padding-left: 8px;
      padding-right: 8px;
    `

    const node = Card({ children: 'hello' }) as HTMLElement

    expect(node.tagName).toBe('DIV')
    expect(node.getAttribute('style')).toContain('color:red')
    expect(node.getAttribute('style')).toContain('padding-left')
    expect(Card.className).toBe('')
    expect(Card.artifact).toMatchObject({ kind: 'cipo.inline-css' })
  })

  it('rewrites styled .css templates to compiledInlineCss artifact calls', () => {
    const source = `
      import { styled } from './runtime'
      export const Panel = styled.div('Panel').css\`
        color: red;
        padding-left: 8px;
      padding-right: 8px;
      \`
    `

    const result = compileCipoSourceInline(source, {
      filename: '/project/src/devtools/panel.ts',
      importPath: '../cipo',
    })

    expect(result.changed).toBe(true)
    expect(result.code).toContain("import { compiledInlineCss } from '../cipo'")
    expect(result.code).toContain("styled.div('Panel')(compiledInlineCss`")
    expect(result.manifest).toHaveLength(1)
    expect(result.manifest[0]?.cssText).toContain('color:red')
  })

  it('computes valid relative compiler imports in the Vite plugin', () => {
    const plugin = cipoVite({ root: '/project', mode: 'inline' })
    const result = plugin.transform?.call({} as never, "export const Panel = styled.div('Panel').css`color: red;`", '/project/src/devtools/panel.ts')

    expect(result && 'code' in result ? result.code : '').toContain("from '../cipo/src/compiler/compiled-inline'")
    expect(result && 'meta' in result ? result.meta.cipo.manifest[0]?.receiver.trim() : '').toBe("styled.div('Panel')")
  })
})
