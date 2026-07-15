import { beforeEach, describe, expect, it } from 'vitest'
import { css, reset, setup } from '@rodkisten/cipo'

beforeEach(() => {
  reset()
  setup({
    prefix: 'debug',
    debug: true,
    minify: true,
    layers: false,
    theme: { colors: { brand: '#38bdf8' }, spacing: '0.25rem' },
  })
})

describe('Cipó readable atomic class names', () => {
  it('uses property and resolved value labels in debug mode', () => {
    const artifact = css`background-attachment: fixed;`
    expect(String(artifact)).toMatch(/^debug-background-attachment-fixed-[a-z0-9]+$/)
  })

    it('keeps the hash deterministic for cache, snapshots and hydration', () => {
    const first = String(css`display:flex;`)
    const second = String(css`display:flex;`)
    expect(second).toBe(first)
  })

      it('preserves compact production names when debug is disabled', () => {
    setup({ debug: false })
    expect(String(css`background-attachment:fixed;`)).toMatch(/^debug-a-[a-z0-9]+$/)
  })

  })
