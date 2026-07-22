import { beforeEach, describe, expect, it } from 'vitest'
import { reset, setup } from '../index'
import {
  decodeResponsiveValue,
  expandResponsiveValueObjects,
  mapResponsiveValue,
} from './responsive'

describe('responsive value syntax', () => {
  beforeEach(() => {
    reset()
    setup({
      breakpoints: {
        base: null,
        sm: '(min-width: 640px)',
        md: '(min-width: 768px)',
      },
    })
  })

  it('lowers property object values into existing responsive syntax', () => {
    expect(
      expandResponsiveValueObjects(`
        gap: {
          base: 8px,
          md: 16px
        }
      `),
    ).toContain('gap: 8px, x:md(16px)')
  })

  it('wraps helper argument objects without losing ownership', () => {
    const result = expandResponsiveValueObjects(`
      text(
        size: {
          base: 14px,
          md: 18px
        },
        lh: 1.4
      )
    `)

    expect(result).toContain(
      'size: responsive(14px, x:md(18px))',
    )
  })

  it('does not reinterpret ordinary CSS blocks as responsive values', () => {
    const source = '.card { color: red }'
    expect(expandResponsiveValueObjects(source)).toBe(source)
  })

  it('rejects objects containing unknown breakpoint keys', () => {
    const source = 'gap: { base: 8px, desktop: 16px }'
    expect(expandResponsiveValueObjects(source)).toBe(source)
  })

  it('maps base and breakpoint values with one shared normalizer', () => {
    expect(
      mapResponsiveValue(
        'responsive(8px, x:md(16px))',
        (value) => `unit(${value})`,
      ),
    ).toBe('unit(8px), x:md(unit(16px))')
    expect(decodeResponsiveValue('responsive(red, x:sm(blue))')).toBe(
      'red, x:sm(blue)',
    )
  })
})
