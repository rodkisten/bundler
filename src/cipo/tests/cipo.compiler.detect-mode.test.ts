import { describe, expect, it } from 'vitest'
import { splitPolymorphicCssSource } from '../src/compiler/detect-mode'

describe('Cipó compiler/detect-mode', () => {
  it('detects inline mode with a single scanner pass', () => {
    const result = splitPolymorphicCssSource('@inline { px: 2 }')
    expect(result.inline).toBe(true)
    expect(result.css.trim()).toBe('px: 2')
  })

  it('splits CSS-first config from stylesheet body', () => {
    const result = splitPolymorphicCssSource('@cipo { prefix: app; } .card { color: red }')
    expect(result.inline).toBe(false)
    expect(result.configCss).toContain('@cipo')
    expect(result.css).toContain('.card')
  })
})
