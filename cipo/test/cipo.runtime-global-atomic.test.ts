/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest'
import { configureFromCss, createStyled, getCssText, injectStyle, reset, setRuntimeStyleTarget } from '@rodkisten/cipo'
import { STYLE_ELEMENT_ID } from '../constants'

function configure(minUses = 2, debug = false): void {
  configureFromCss(`
    @cipo {
      prefix: test;
      layers: false;
      debug: ${debug};
      minify: true;
      atomic-min-uses: ${minUses};
    }
  `)
}

describe('Cipó runtime global atomic stylesheet', () => {
  beforeEach(() => {
    reset()
    configure()
  })

  it('keeps the first use scoped and promotes the second use into one shared atom', () => {
    const styled = createStyled()
    const First = styled.div`display:flex;color:red;`
    const sharedClass = First.className.split(/\s+/).find((name) => name.startsWith('test-a-'))

    expect(sharedClass).toBeTruthy()
    expect(getCssText()).not.toContain(`.${sharedClass}{display:flex}`)
    expect(getCssText()).toContain('display:flex')

    const Second = styled.button`display:flex;color:blue;`

    expect(Second.className.split(/\s+/)).toContain(sharedClass)
    expect(getCssText()).toContain(`.${sharedClass}{display:flex}`)
    expect(getCssText().match(/display:flex/g)).toHaveLength(1)
    expect(getCssText().match(/color:red/g)).toHaveLength(1)
    expect(getCssText().match(/color:blue/g)).toHaveLength(1)
  })

  it('honors a CSS-first promotion threshold greater than two', () => {
    reset()
    configure(3)
    const styled = createStyled()
    const First = styled.div`display:flex;`
    const sharedClass = First.className.split(/\s+/).find((name) => name.startsWith('test-a-'))

    styled.button`display:flex;`
    expect(getCssText()).not.toContain(`.${sharedClass}{display:flex}`)

    styled.section`display:flex;`
    expect(getCssText()).toContain(`.${sharedClass}{display:flex}`)
    expect(getCssText().match(/display:flex/g)).toHaveLength(1)
  })

  it('uses CSS-first debug mode to switch between compact and semantic atomic names', () => {
    const compact = createStyled().div`display:flex;`
    expect(compact.className).toMatch(/test-a-[a-z0-9]+/)

    reset()
    configure(2, true)
    const semantic = createStyled().div`display:flex;`
    expect(semantic.className).toMatch(/test-display-flex-[a-z0-9]+/)
  })

  it('uses one style element for the active target and the whole styled registry', () => {
    const host = document.createElement('div')
    const shadow = host.attachShadow({ mode: 'open' })
    setRuntimeStyleTarget(shadow)

    const styled = createStyled()
    styled.div`display:flex;color:red;`
    styled.button`display:flex;color:blue;`

    const style = injectStyle(shadow, styled.registry.cssArtifacts)

    expect(style.id).toBe(STYLE_ELEMENT_ID)
    expect(shadow.querySelectorAll('style')).toHaveLength(1)
    expect(style.textContent?.match(/display:flex/g)).toHaveLength(1)
  })
})
