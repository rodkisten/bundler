/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { compileCipoSourceBuild, cipoVite, setup } from '../src'
import { compileFabricaSource, createCompiledElement, createCompiledTemplate } from '../../fabrica'

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

  it('creates dynamic DOM templates with runtime-backed @event bindings', () => {
    let clicked = 0
    const view = createCompiledTemplate(['<button @click=', '>Save ', '</button>'] as unknown as TemplateStringsArray, () => { clicked += 1 }, 'now')
    const button = view.firstChild as HTMLButtonElement

    expect(button.tagName).toBe('BUTTON')
    expect(button.textContent).toBe('Save now')
    button.click()
    expect(clicked).toBe(1)
  })

  it('Vite plugin injects compiled CSS through Cipó runtime style tag and compiles Fabrica in build mode', () => {
    const plugin = cipoVite({ root: '/project', mode: 'build', compileFabrica: true })
    const context = { emitFile: () => 'asset' } as never
    const transformed = plugin.transform?.call(
      context,
      "const Card = styled.div('Card').css`color: red;`; const view = html`<section class=\"x\">Ok</section>`",
      '/project/src/devtools/card.ts',
    )

    const code = transformed && 'code' in transformed ? transformed.code : ''
    expect(code).toContain('insertCss as __cipoInsertCompiledCss')
    expect(code).toContain('compileScopedSheetCss as __cipoCompileScopedSheetCss')
    expect(code).toContain('color: red;')
    expect(code).toContain('createCompiledElement("section"')
    const runtimeModule = plugin.load?.call(context, '\0cipo:compiled-style-tag.js')
    expect(runtimeModule).toContain('insertCss')
    expect(runtimeModule).toContain('color:red')
  })
})
