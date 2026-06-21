// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { flushSync, store } from '../../broto'
import { html, render } from '../index'

describe('Fabrica store view bindings', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders Broto store signal leaves directly', () => {
    const state = store({ user: { name: 'Rod' } })
    const host = document.createElement('div')

    render(host, html`<span>${state.user.name}</span>`)
    expect(host.textContent).toBe('Rod')

    state.user.name.set('Fabrica')
    flushSync()
    expect(host.textContent).toBe('Fabrica')
  })

  it('renders Broto store view paths without wrapping a function in templates', () => {
    const state = store({ user: { name: 'Rod' } })
    const host = document.createElement('div')

    render(host, html`<span>${state.view.user.name}</span>`)
    expect(host.textContent).toBe('Rod')

    state.setPath(['user', 'name'], 'Cipó')
    flushSync()
    expect(host.textContent).toBe('Cipó')
  })
})
