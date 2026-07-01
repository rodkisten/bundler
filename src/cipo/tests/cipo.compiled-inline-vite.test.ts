/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest'
import Fabrica, { clearComponents, html, render, resolveComponent } from '../../fabrica'
import {
  cipoVite,
  compiledInlineCss,
  compileCipoSourceInline,
  createCompiledStyled,
  getCssText,
  reset,
  setup,
} from '../src/index'

let host: HTMLDivElement

beforeEach(() => {
  document.body.replaceChildren()
  host = document.createElement('div')
  document.body.append(host)
  clearComponents()
  reset()
  setup({
    prefix: 'compiled-inline',
    adapter: 'dom',
    minify: true,
    layers: false,
  })
})

describe('Cipó compiled inline playground', () => {
  it('compiles tagged templates to inline artifacts without emitting stylesheet CSS', () => {
    const artifact = compiledInlineCss`
      display: flex;
      px: 2;
      color: red;
    `

    expect(artifact.kind).toBe('cipo.inline-css')
    expect(artifact.cssText).toContain('display:flex')
    expect(artifact.cssText).toContain('padding-inline')
    expect(artifact.cssText).toContain('color:red')
    expect(getCssText()).toBe('')
  })

  it('creates Fabrica styled components whose CSS is inline by default', () => {
    const styled = createCompiledStyled({ fabrica: Fabrica })
    const Card = styled.div('CompiledCard').css`
      display: grid;
      gap: 8px;
      color: red;
    `

    expect(Card.className).toBe('')
    expect(Card.artifact?.kind).toBe('cipo.inline-css')
    expect(resolveComponent('CompiledCard')).toBe(Card)

    render(host, html`<CompiledCard style=${'opacity:.9;'}>Compiled</CompiledCard>`)
    const node = host.querySelector('div') as HTMLDivElement
    expect(node.textContent).toBe('Compiled')
    expect(node.getAttribute('class')).toBeNull()
    expect(node.getAttribute('style')).toContain('display:grid')
    expect(node.getAttribute('style')).toContain('gap:0.5rem')
    expect(node.getAttribute('style')).toContain('opacity:.9')
    expect(getCssText()).toBe('')
  })

  it('rewrites styled .css templates through the Vite adapter into inline artifact calls', () => {
    const source = `
      import { styled } from '../src/index'
      const Box = styled.div('Box').css\`
        display: flex;
        color: red;
      \`
    `

    const plugin = cipoVite({ filenameImportPath: '../src/index' })
    const result = plugin.transform(source, '/project/src/box.ts')

    expect(result).not.toBeNull()
    expect(result!.code).toContain("import { compiledInlineCss } from '../src/index'")
    expect(result!.code).toContain("styled.div('Box')(compiledInlineCss`")
    expect(result!.meta.cipo.manifest).toHaveLength(1)
    expect(result!.meta.cipo.manifest[0]?.cssText).toContain('display:flex')
  })

  it('exposes the source compiler directly for DevTools playground probes', () => {
    const result = compileCipoSourceInline("const X = styled.button('X').css`px: 2; color: red;`", {
      filename: 'devtools-playground.ts',
      importPath: '../src/index',
    })

    expect(result.changed).toBe(true)
    expect(result.code).toContain('compiledInlineCss`px: 2; color: red;`')
    expect(result.manifest[0]?.filename).toBe('devtools-playground.ts')
    expect(result.manifest[0]?.cssText).toContain('padding-inline')
  })
})
