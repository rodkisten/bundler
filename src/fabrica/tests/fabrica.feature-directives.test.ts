/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { bind, eventOptions, fragment, html, keyed, memoView, model, render, signal } from '../index'

describe('Fabrica feature directives', () => {
  it('supports bind/model two-way input directives', () => {
    const root = document.createElement('div')
    const name = signal('Rod')
    render(root, html`<input class="field" .value=${bind(name)} />`)
    const input = root.querySelector('input') as HTMLInputElement
    expect(input.value).toBe('Rod')
    input.value = 'Broto'
    input.dispatchEvent(new Event('input'))
    expect(name()).toBe('Broto')

    const checked = signal(false)
    render(root, html`<input type="checkbox" .checked=${model(checked)} />`)
    const box = root.querySelector('input') as HTMLInputElement
    box.checked = true
    box.dispatchEvent(new Event('change'))
    expect(checked()).toBe(true)
  })

  it('supports eventOptions wrappers', () => {
    const root = document.createElement('div')
    const onClick = vi.fn()
    render(root, html`<button @click=${eventOptions(onClick, { once: true })}>Save</button>`)
    const button = root.querySelector('button')!
    button.click()
    button.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('supports keyed remount and fragment helpers', () => {
    const root = document.createElement('div')
    const key = signal('a')
    render(root, html`${keyed(key, () => fragment(html`<span>${key()}</span>`))}`)
    expect(root.textContent).toBe('a')
    key.set('b')
    return Promise.resolve().then(() => expect(root.textContent).toBe('b'))
  })

  it('memoizes view factories by argument identity', () => {
    const renderLabel = vi.fn((value: string) => html`<span>${value}</span>`)
    const memo = memoView(renderLabel)
    const first = memo('a')
    const second = memo('a')
    expect(first).toBe(second)
    expect(renderLabel).toHaveBeenCalledTimes(1)
  })
})
