import { describe, expect, it } from 'vitest'
import {
  geometricMeanPercent,
  median,
  medianAbsoluteDeviationPercent,
} from './statistics'

describe('benchmark statistics', () => {
  it('uses the median and ignores non-finite values', () => {
    expect(median([9, 1, 5])).toBe(5)
    expect(median([1, 3, 5, 7])).toBe(4)
    expect(median([Number.NaN, 4, Number.POSITIVE_INFINITY])).toBe(4)
  })

  it('uses MAD so one host pause does not dominate run variation', () => {
    expect(medianAbsoluteDeviationPercent([100, 101, 99])).toBeCloseTo(1)
    expect(medianAbsoluteDeviationPercent([100, 100, 1000])).toBe(0)
  })

  it('calculates geometric mean deltas from throughput ratios', () => {
    expect(geometricMeanPercent([2, 0.5])).toBeCloseTo(0)
    expect(geometricMeanPercent([1.1, 1.1])).toBeCloseTo(10)
    expect(geometricMeanPercent([])).toBeNull()
  })
})
