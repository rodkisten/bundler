/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fabrica, { clearComponents, html, render, resolveComponent } from '../../fabrica'
import { reset, setup, styled } from '../src/index'

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
    expect(button.className).toContain('registry-a-')
    button.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('supports Cipo.component(name, { as, attrs }) without passing a function to html', () => {
    const Card = styled.component('SettingsCard', {
      as: 'article',
      attrs: (props) => ({ role: 'region', 'aria-label': props.label }),
    }).css`
      p: 4
      bg: $brand
    `

    expect(resolveComponent('SettingsCard')).toBe(Card)
    render(host, html`<SettingsCard label="Settings">Panel</SettingsCard>`)

    const article = host.querySelector('article') as HTMLElement
    expect(article.getAttribute('role')).toBe('region')
    expect(article.getAttribute('aria-label')).toBe('Settings')
    expect(article.textContent).toBe('Panel')
  })

  it('supports direct named template invocation and manual unregister/register', () => {
    const Badge = styled.span('StatusBadge')`
      px: 2
      rounded: 999px
    `

    expect(resolveComponent('StatusBadge')).toBe(Badge)
    expect(Badge.unregister()).toBe(true)
    expect(resolveComponent('StatusBadge')).toBeUndefined()
    expect(Badge.register()).toBe('registered')
    expect(resolveComponent('StatusBadge')).toBe(Badge)
  })
})
