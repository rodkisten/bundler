/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { compileCipoSourceBuild, cipoVite, setup } from '../src'
import { compileFabricaSource, createCompiledElement } from '../../fabrica'

describe('Cipó + Fábrica compiled build mode', () => {
  it('compiles styled Cipó templates into real scoped CSS classes', () => {
    setup({ adapter: 'dom' })
    const source = `
      import { styled } from '../devtools/components/runtime'
      export const Panel = styled.div('Panel').css\`
        display: flex;
        gap: 8px;
        &:hover { opacity: 0.9; }
      \`
    `

    const result = compileCipoSourceBuild(source, {
      filename: '/project/src/devtools/panel.ts',
      classPrefix: 'cp',
      injectCssImport: false,
    })

    expect(result.changed).toBe(true)
    expect(result.code).toContain("styled.div('Panel')(")
    expect(result.code).not.toContain('.css`')
    expect(result.css).toContain('.cp-Panel-')
    expect(result.css).toContain('display:flex')
    expect(result.css).toContain(':hover')
    expect(result.manifest[0]?.kind).toBe('styled-css')
  })

  it('leaves dynamic Cipó templates on the runtime path', () => {
    const result = compileCipoSourceBuild("const Box = styled.div('Box').css`color: ${tone};`", {
      injectCssImport: false,
    })

    expect(result.changed).toBe(false)
    expect(result.css).toBe('')
  })

  it('compiles simple Fabrica html templates to createCompiledElement', () => {
    const result = compileFabricaSource("const view = html`<button class=\"save\">Salvar</button>`", {
      filename: '/project/src/view.ts',
      importPath: '../fabrica/compiler',
    })

    expect(result.changed).toBe(true)
    expect(result.code).toContain('createCompiledElement("button"')
    expect(result.code).toContain('{"class":"save"}')
    expect(result.manifest[0]?.tag).toBe('button')
  })

  it('creates DOM recursively with props, events and children', () => {
    let clicked = 0
    const node = createCompiledElement('button', { class: 'save', onClick: () => { clicked += 1 } }, 'Salvar') as HTMLButtonElement

    expect(node.tagName).toBe('BUTTON')
    expect(node.className).toBe('save')
    expect(node.textContent).toBe('Salvar')
    node.click()
    expect(clicked).toBe(1)
  })

  it('Vite plugin emits virtual CSS and compiles Fabrica in build mode', () => {
    const plugin = cipoVite({ root: '/project', mode: 'build', compileFabrica: true })
    const context = { emitFile: () => 'asset' } as never
    const transformed = plugin.transform?.call(
      context,
      "const Card = styled.div('Card').css`color: red;`; const view = html`<section class=\"x\">Ok</section>`",
      '/project/src/devtools/card.ts',
    )

    expect(transformed && 'code' in transformed ? transformed.code : '').toContain("\\0cipo:compiled.css")
    expect(transformed && 'code' in transformed ? transformed.code : '').toContain('createCompiledElement("section"')
    const css = plugin.load?.call(context, '\0cipo:compiled.css')
    expect(css).toContain('color:red')
  })
})
