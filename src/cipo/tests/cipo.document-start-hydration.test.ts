import { expect, it } from 'vitest'
import { getCssText, reset, setup } from '../../cipo'

it('hydrates theme CSS created before document.head exists', async () => {
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
