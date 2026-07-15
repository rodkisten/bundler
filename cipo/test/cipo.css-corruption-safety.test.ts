// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { getCssText, reset, setup } from '@rodkisten/cipo'

describe('Cipó CSS corruption safety', () => {
  beforeEach(() => {
    reset()
    setup({
      prefix: 'safe',
      layers: false,
      minify: true,
      theme: { colors: { strong: '#fff', panel: '#111', cyan: '#0ff' } },
    })
  })

  it('hydrates theme CSS generated before document.head exists', async () => {
    document.head?.remove()
    reset()
    setup({ prefix: 'early', layers: false, theme: { colors: { strong: '#abcdef' } } })

    expect(getCssText()).toContain('--early-colors-strong')
    expect(document.getElementById('cipo-runtime-style')).toBeNull()

    const head = document.createElement('head')
    document.documentElement.insertBefore(head, document.body)
    document.dispatchEvent(new Event('readystatechange'))
    await Promise.resolve()

    expect(document.getElementById('cipo-runtime-style')?.textContent)
      .toContain('--early-colors-strong:#abcdef')
  })
})
