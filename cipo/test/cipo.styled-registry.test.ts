/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fabrica, { clearComponents, createFabrica, html, render, resolveComponent } from '@rodkisten/cipo/fabrica'
import { createStyled, reset, setup, styled } from '@rodkisten/cipo'

let host: HTMLDivElement

beforeEach(() => {
  document.body.replaceChildren()
  host = document.createElement('div')
  document.body.append(host)
  clearComponents()
  reset()
  setup({
    prefix: 'registry',
    minify: true,
    layers: false,
    theme: {
      colors: { brand: '#38bdf8', ink: '#020617' },
      spacing: '0.25rem',
    },
  })
  styled.connectRegistry(Fabrica)
})

describe('Cipó styled components and Fabrica registry', () => {
  it('auto-registers a named styled component and renders it by name in normal html', () => {
    const onClick = vi.fn()
    const Button = styled.button('RegistryButton').css`
      px: 4
      py: 2
      bg: $brand
      color: $ink
    `

    expect(resolveComponent('RegistryButton')).toBe(Button)

    render(host, html`
      <RegistryButton type="button" onClick=${onClick}>Save</RegistryButton>
    `)

    const button = host.querySelector('button') as HTMLButtonElement
    expect(button.textContent).toBe('Save')
    expect(button.className).toContain('registry-padding-inline-')
    button.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

      it('creates independent styled factories for isolated Fabrica instances', () => {
    const first = createFabrica({ name: 'styled-first' })
    const second = createFabrica({ name: 'styled-second' })
    const firstStyled = createStyled({ fabrica: first })
    const secondStyled = createStyled({ fabrica: second })

    const FirstButton = firstStyled.button('ScopedButton').css`display:inline-flex;`
    const SecondButton = secondStyled.button('ScopedButton').css`display:grid;`

    expect(first.resolveComponent('ScopedButton')).toBe(FirstButton)
    expect(second.resolveComponent('ScopedButton')).toBe(SecondButton)
    expect(first.resolveComponent('ScopedButton')).not.toBe(second.resolveComponent('ScopedButton'))

    const firstHost = document.createElement('div')
    const secondHost = document.createElement('div')
    first.render(firstHost, first.html`<ScopedButton>one</ScopedButton>`)
    second.render(secondHost, second.html`<ScopedButton>two</ScopedButton>`)

    expect(firstHost.querySelector('button')?.textContent).toBe('one')
    expect(secondHost.querySelector('button')?.textContent).toBe('two')
  })
  it('unwraps Fabrica ref directives when rendering named styled components', () => {
    const local = createFabrica({ name: 'styled-ref', isolated: true })
    const localStyled = createStyled({ fabrica: local })
    let buttonRef: HTMLButtonElement | null = null

    localStyled.button('RefButton').css`
      px: 2
      color: $ink
    `

    local.render(host, local.html`
      <RefButton ref=${local.ref<HTMLButtonElement>((node) => { buttonRef = node })}>Save</RefButton>
    `)

    const button = host.querySelector('button') as HTMLButtonElement | null
    expect(button).toBeInstanceOf(HTMLButtonElement)
    expect(buttonRef).toBe(button)
    expect(button?.textContent).toBe('Save')
  })

})
