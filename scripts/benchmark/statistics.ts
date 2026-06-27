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
