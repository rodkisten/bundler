import { describe, expect, it } from 'vitest'
import {
  parseRuntimeStateCondition,
  parseRuntimeStateConditions,
  parseRuntimeStateValues,
  renderRuntimeStateCondition,
} from './state-selectors'

describe('runtime state selector contracts', () => {
  it('mirrors Fábrica data-state naming', () => {
    const condition = parseRuntimeStateCondition(
      ':panelState="HighContrast"',
    )

    expect(condition).toEqual({
      kind: 'data',
      name: 'panel-state',
      value: 'HighContrast',
      negate: false,
    })
    expect(renderRuntimeStateCondition(condition!)).toBe(
      '[data-panel-state="HighContrast"]',
    )
  })

  it('supports presence, boolean and negated conditions', () => {
    const conditions = parseRuntimeStateConditions(
      ':active, !loading, ?disabled, !?checked',
    )

    expect(conditions.map(renderRuntimeStateCondition)).toEqual([
      '[data-active]',
      ':not([data-loading])',
      '[disabled]',
      ':not([checked])',
    ])
  })

  it('accepts colon and equals value separators', () => {
    expect(
      renderRuntimeStateCondition(
        parseRuntimeStateCondition('tone:danger')!,
      ),
    ).toBe('[data-tone="danger"]')
    expect(
      renderRuntimeStateCondition(
        parseRuntimeStateCondition('tone=warning')!,
      ),
    ).toBe('[data-tone="warning"]')
  })

  it('normalizes compound arrays while preserving scalar parsing', () => {
    expect(parseRuntimeStateValues('[lg, "2xl", highContrast]')).toEqual([
      'lg',
      '2xl',
      'high-contrast',
    ])
    expect(parseRuntimeStateValues('primary')).toEqual(['primary'])
  })

  it('rejects empty and malformed state expressions safely', () => {
    expect(parseRuntimeStateCondition('')).toBeNull()
    expect(parseRuntimeStateCondition(':')).toBeNull()
    expect(parseRuntimeStateCondition('?')).toBeNull()
    expect(parseRuntimeStateCondition('tone=')).toBeNull()
  })
})
