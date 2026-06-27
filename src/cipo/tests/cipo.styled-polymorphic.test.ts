/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest'
import Fabrica, { clearComponents, html, render, resolveComponent } from '../../fabrica'
import { css, getCssText, inline, reset, setup, styled } from '../src/index'

let host: HTMLDivElement

beforeEach(() => {
  document.body.replaceChildren()
  host = document.createElement('div')
  document.body.append(host)
  clearComponents()
  reset()
  setup({
    prefix: 'poly-style',
    debug: false,
    minify: true,
    layers: false,
    theme: { colors: { brand: '#38bdf8', danger: '#ef4444' }, spacing: '0.25rem' },
  })
  styled.connectRegistry(Fabrica)
})

describe('Cipó polymorphic artifacts in Fabrica Elements styled', () => {
  it('accepts the exact styled.div(name)(css``) composition', () => {
    const brandCss = css`
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    `
    const Brand = styled.div('Brand')(brandCss)

    expect(Brand.artifact).toBe(brandCss)
    expect(Brand.artifacts).toEqual([brandCss])
    expect(Brand.className).toBe(brandCss.className)
    expect(resolveComponent('Brand')).toBe(Brand)

    render(host, html`<Brand>Alerta</Brand>`)
    const node = host.querySelector('div') as HTMLDivElement
    expect(node.textContent).toBe('Alerta')
    expect(node.className).toBe(brandCss.className)
  })

  it('supports static arrays, conditionals and prop-driven artifact functions', () => {
    const base = css`display:inline-flex;`
    const danger = css`color:$danger;`
    const Button = styled.button('ArtifactButton')([
      base,
      (props) => Boolean(props.danger) && danger,
    ])

    expect(Button.className).toBe(base.className)
    expect(Button.dynamicStyles).toBe(true)

    const safe = Button({ children: 'Safe' }) as HTMLButtonElement
    const destructive = Button({ danger: true, children: 'Delete' }) as HTMLButtonElement
    expect(safe.className).toBe(base.className)
    expect(destructive.className).toContain(base.className)
    expect(destructive.className).toContain(danger.className)
  })

  it('supports functions that compile css from props at render time', () => {
    const Status = styled.span('Status')((props) => css`
      opacity: ${props.disabled ? 0.5 : 1};
      color: ${props.disabled ? '$danger' : '$brand'};
    `)

    expect(Status.dynamicStyles).toBe(true)
    expect(Status.className).toBe('')

    const enabled = Status({ children: 'Ready' }) as HTMLSpanElement
    const disabled = Status({ disabled: true, children: 'Paused' }) as HTMLSpanElement
    expect(enabled.className).not.toBe(disabled.className)
    expect(enabled.textContent).toBe('Ready')
    expect(disabled.textContent).toBe('Paused')
  })

  it('applies inline artifacts and keeps caller style precedence', () => {
    const inlineArtifact = inline.css`
      color: red;
      opacity: 0.7;
    `
    const InlineBox = styled.div('InlineBox')(inlineArtifact)
    const node = InlineBox({ style: { opacity: '1', padding: '4px' } }) as HTMLDivElement

    expect(node.style.color).toBe('red')
    expect(node.style.opacity).toBe('1')
    expect(node.style.padding).toBe('4px')
  })

  it('accepts stylesheet artifacts as deduped global side effects', () => {
    const sheetArtifact = css`.artifact-sheet { color: red; }`
    const GlobalStyles = styled.div('GlobalStyles')(sheetArtifact)
    const firstCss = getCssText()
    GlobalStyles({ children: 'one' })
    GlobalStyles({ children: 'two' })

    expect(firstCss).toContain('.artifact-sheet')
    expect(getCssText()).toBe(firstCss)
    expect(GlobalStyles.className).toBe('')
  })

  it('supports anonymous artifact styling and component extension', () => {
    const base = css`display:flex;`
    const compact = css`gap:4px;`
    const Base = styled.div(base)
    const Compact = styled(Base).named('CompactBrand')(compact)

    const node = Compact({ children: 'Brand' }) as HTMLDivElement
    expect(node.className).toContain(base.className)
    expect(node.className).toContain(compact.className)
    expect(resolveComponent('CompactBrand')).toBe(Compact)
  })

  it('preserves attrs and polymorphic as with artifact input', () => {
    const artifact = css`display:inline-flex;`
    const Action = styled.button
      .attrs({ type: 'button' })
      .named('ArtifactAction', { attrs: (props) => ({ 'aria-label': props.label }) })(artifact)

    const link = Action({ as: 'a', href: '/settings', label: 'Settings', children: 'Settings' }) as HTMLAnchorElement
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/settings')
    expect(link.getAttribute('aria-label')).toBe('Settings')
    expect(link.className).toBe(artifact.className)
  })
})
