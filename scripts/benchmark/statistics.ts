/** Returns the median without mutating the caller's array. */
export function median(values: readonly number[]): number {
  const sorted = values.filter(Number.isFinite).slice().sort((left, right) => left - right)
  if (sorted.length === 0) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!
}

/**
 * Returns median absolute deviation as a percentage of the median.
 *
 * MAD is deliberately preferred over standard deviation because benchmark
 * workers occasionally experience one-off host pauses and GC spikes.
 */
export function medianAbsoluteDeviationPercent(values: readonly number[]): number {
  const center = median(values)
  if (center <= 0) return 0
  const deviation = median(values.map((value) => Math.abs(value - center)))
  return (deviation / center) * 100
}

/** Computes a geometric mean delta from positive throughput ratios. */
export function geometricMeanPercent(ratios: readonly number[]): number | null {
  const valid = ratios.filter((ratio) => Number.isFinite(ratio) && ratio > 0)
  if (valid.length === 0) return null
  return (Math.exp(valid.reduce((sum, ratio) => sum + Math.log(ratio), 0) / valid.length) - 1) * 100
}

/** Population standard deviation, used only for benchmark diagnostics. */
export function standardDeviation(values: readonly number[]): number {
  const valid = values.filter(Number.isFinite)
  if (valid.length === 0) return 0
  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length
  const variance = valid.reduce((sum, value) => sum + (value - mean) ** 2, 0) / valid.length
  return Math.sqrt(variance)
}

/** Coefficient of variation as percentage. */
export function coefficientOfVariationPercent(values: readonly number[]): number {
  const valid = values.filter(Number.isFinite)
  if (valid.length === 0) return 0
  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length
  if (mean <= 0) return 0
  return (standardDeviation(valid) / mean) * 100
}
