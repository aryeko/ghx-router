import type { DescriptiveStats } from "@profiler/types/metrics.js"

function percentile(sorted: readonly number[], p: number): number {
  const n = sorted.length
  if (n === 0) return 0
  if (n === 1) return sorted[0] ?? 0

  const index = (p / 100) * (n - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const fraction = index - lower
  const lowerVal = sorted[lower] ?? 0
  const upperVal = sorted[upper] ?? 0
  return lowerVal * (1 - fraction) + upperVal * fraction
}

/**
 * Compute descriptive statistics for a set of numeric values.
 *
 * Calculates count, mean, median, p90, p95, min, max, IQR, coefficient of
 * variation, and sample standard deviation. Returns all zeros for an empty input.
 *
 * @param values - The numeric samples to summarize.
 * @returns A DescriptiveStats object with all computed statistics.
 */
export function computeDescriptive(values: readonly number[]): DescriptiveStats {
  const count = values.length

  if (count === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      p90: 0,
      p95: 0,
      min: 0,
      max: 0,
      iqr: 0,
      cv: 0,
      stddev: 0,
    }
  }

  const sorted = [...values].sort((a, b) => a - b)

  const sum = sorted.reduce((acc, v) => acc + v, 0)
  const mean = sum / count

  const median = percentile(sorted, 50)
  const p90 = percentile(sorted, 90)
  const p95 = percentile(sorted, 95)
  const p25 = percentile(sorted, 25)
  const p75 = percentile(sorted, 75)

  const min = sorted[0] ?? 0
  const max = sorted[count - 1] ?? 0
  const iqr = p75 - p25

  const variance =
    count === 1 ? 0 : sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (count - 1)
  const stddev = Math.sqrt(variance)

  const cv = mean === 0 ? 0 : stddev / mean

  return { count, mean, median, p90, p95, min, max, iqr, cv, stddev }
}
