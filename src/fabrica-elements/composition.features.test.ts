import { describe, expect, it, vi } from 'vitest'
import { asChild, composeProps, recipe, variant } from './index'

describe('Fabrica Elements composition features', () => {
  it('resolves recipes with defaults and variants', () => {
    const button = recipe({
      base: { class: 'btn', type: 'button' },
      variants: { tone: { primary: { class: 'primary' }, danger: { class: 'danger' } } },
      defaults: { tone: 'primary' },
    })
    expect(button({ class: 'extra' }).class).toBe('btn primary extra')
    expect(button({ tone: 'danger' }).class).toBe('btn danger')
  })

  it('resolves standalone variants', () => {
    const tone = variant({ info: { class: 'info' } }, 'info')
    expect(tone().class).toBe('info')
  })

  it('composes events and creates asChild payloads', () => {
    const a = vi.fn()
    const b = vi.fn()
    const props = composeProps({ onClick: a }, { onClick: b })
    props.onClick(new Event('click'))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    expect(asChild('span', { class: 'x' })).toEqual({ asChild: true, child: 'span', props: { class: 'x' } })
  })
})
