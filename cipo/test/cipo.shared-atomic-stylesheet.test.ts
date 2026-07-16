import { beforeEach, describe, expect, it } from 'vitest'
import { configureFromCss, createStyled, getCssText, injectStyle, reset } from '@rodkisten/cipo'
import { compileCipoSourceBuild } from '@rodkisten/cipo/compiler-compiled-build'

const SHARED_CONFIG = `
  @cipo {
    prefix: test;
    layers: false;
    debug: false;
    minify: true;
    atomic-min-uses: 2;
  }
`

describe('Cipó shared atomic stylesheet', () => {
  beforeEach(() => {
    reset()
    configureFromCss(SHARED_CONFIG)
  })

  it('keeps first-use declarations scoped and promotes the second shared use once', () => {
    const styled = createStyled()

    const First = styled.div`
      display: flex;
      color: red;
    `

    const firstCss = getCssText()
    expect(firstCss.match(/display:flex/g)?.length).toBe(1)
    expect(firstCss).toContain(`.${First.className.split(' ')[0]}`)

    const Second = styled.section`
      display: flex;
      color: blue;
    `

    const css = getCssText()
    expect(css.match(/display:flex/g)?.length).toBe(1)
    expect(css.match(/color:red/g)?.length).toBe(1)
    expect(css.match(/color:blue/g)?.length).toBe(1)
    expect(css).toMatch(/\.test-a-[a-z0-9]+\{display:flex\}/)
    expect(First.className).toContain('test-a-')
    expect(Second.className).toContain('test-a-')
  })

  it('folds an entire styled registry into one target stylesheet', () => {
    const styled = createStyled()
    styled.div`display:flex;color:red;`
    styled.button`display:flex;color:blue;`

    const host = document.createElement('div')
    const shadow = host.attachShadow({ mode: 'open' })
    const style = injectStyle(shadow, styled.registry.cssArtifacts)

    expect(shadow.querySelectorAll('style')).toHaveLength(1)
    expect(style.textContent?.match(/display:flex/g)?.length).toBe(1)
    expect(style.textContent?.match(/color:red/g)?.length).toBe(1)
    expect(style.textContent?.match(/color:blue/g)?.length).toBe(1)
  })

  it('keeps build-compiled styled CSS coupled as atomic metadata instead of per-component CSS', () => {
    const source = `
      import { styled } from '@rodkisten/cipo';
      export const A = styled.div\`display:flex;color:red;\`;
      export const B = styled.button\`display:flex;color:blue;\`;
    `

    const result = compileCipoSourceBuild(source, {
      filename: '/src/components.ts',
      configCss: SHARED_CONFIG,
      coupleStyledCss: true,
      transformCssTag: true,
      injectCssImport: false,
    })

    expect(result.changed).toBe(true)
    expect(result.code.match(/attachCompiledCss/g)?.length).toBeGreaterThanOrEqual(2)
    expect(result.css).toBe('')
    expect(result.code).not.toContain('display:flex;color:red')
    expect(result.code).not.toContain('display:flex;color:blue')
  })
})
