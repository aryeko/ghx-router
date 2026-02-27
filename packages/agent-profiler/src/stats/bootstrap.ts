import {
  DEFAULT_BOOTSTRAP_RESAMPLES,
  DEFAULT_CONFIDENCE_LEVEL,
} from "@profiler/shared/constants.js"
import type { ConfidenceInterval } from "@profiler/types/metrics.js"
import { mulberry32 } from "./prng.js"

function defaultStatistic(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const index = 0.5 * (n - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const fraction = index - lower
  const lowerVal = sorted[lower] ?? 0
  const upperVal = sorted[upper] ?? 0
  return lowerVal * (1 - fraction) + upperVal * fraction
}

/** Options for configuring a bootstrap confidence interval computation. */
export interface BootstrapCIOptions {
  /** Number of bootstrap resamples to draw (defaults to DEFAULT_BOOTSTRAP_RESAMPLES). */
  readonly resamples?: number
  /** Confidence level for the interval, e.g. 0.95 for a 95% CI (defaults to DEFAULT_CONFIDENCE_LEVEL). */
  readonly confidenceLevel?: number
  /** Statistic function applied to each resample (defaults to median). */
  readonly statistic?: (values: readonly number[]) => number
  /** Random seed for reproducible resampling (defaults to 42). */
  readonly seed?: number
}

/**
 * Compute a bootstrap confidence interval for a statistic over a single sample.
 *
 * Uses the percentile method with a seeded deterministic PRNG for reproducibility.
 * Returns a degenerate interval (lower === upper === pointEstimate) when the input
 * has one or fewer values.
 *
 * @param values - The numeric sample to bootstrap.
 * @param options - Optional configuration for resamples, confidence level, statistic, and seed.
 * @returns A ConfidenceInterval describing the uncertainty around the point estimate.
 */
export function bootstrapCI(
  values: readonly number[],
  options?: BootstrapCIOptions,
): ConfidenceInterval {
  const resamples = options?.resamples ?? DEFAULT_BOOTSTRAP_RESAMPLES
  const confidenceLevel = options?.confidenceLevel ?? DEFAULT_CONFIDENCE_LEVEL
  const statistic = options?.statistic ?? defaultStatistic
  const seed = options?.seed ?? 42

  const pointEstimate = statistic(values)

  if (values.length <= 1) {
    return {
      lower: pointEstimate,
      upper: pointEstimate,
      confidenceLevel,
      resamples,
      pointEstimate,
    }
  }

  const rng = mulberry32(seed)
  const n = values.length
  const bootstrapStats: number[] = []

  for (let i = 0; i < resamples; i++) {
    const resample: number[] = []
    for (let j = 0; j < n; j++) {
      const idx = Math.floor(rng() * n)
      resample.push(values[idx] ?? 0)
    }
    bootstrapStats.push(statistic(resample))
  }

  bootstrapStats.sort((a, b) => a - b)

  const alpha = 1 - confidenceLevel
  const lowerIdx = Math.floor((alpha / 2) * resamples)
  const upperIdx = Math.floor((1 - alpha / 2) * resamples) - 1

  const lower = bootstrapStats[Math.max(0, lowerIdx)] ?? pointEstimate
  const upper = bootstrapStats[Math.min(resamples - 1, upperIdx)] ?? pointEstimate

  return { lower, upper, confidenceLevel, resamples, pointEstimate }
}

/**
 * Compute a bootstrap confidence interval for the percentage reduction of modeA relative to modeB.
 *
 * The point estimate is `(1 - median(modeA) / median(modeB)) * 100`. Positive values indicate
 * modeA is lower than modeB (a reduction). Uses the percentile bootstrap method with a seeded
 * PRNG for reproducibility.
 *
 * @param modeA - Numeric samples for the candidate mode (lower values are better).
 * @param modeB - Numeric samples for the baseline mode.
 * @param options - Optional configuration for resamples, confidence level, statistic, and seed.
 * @returns A ConfidenceInterval whose point estimate and bounds are reduction percentages.
 */
export function bootstrapReductionCI(
  modeA: readonly number[],
  modeB: readonly number[],
  options?: BootstrapCIOptions,
): ConfidenceInterval {
  const resamples = options?.resamples ?? DEFAULT_BOOTSTRAP_RESAMPLES
  const confidenceLevel = options?.confidenceLevel ?? DEFAULT_CONFIDENCE_LEVEL
  const statistic = options?.statistic ?? defaultStatistic
  const seed = options?.seed ?? 42

  const medA = statistic(modeA)
  const medB = statistic(modeB)
  const pointEstimate = medB === 0 ? 0 : (1 - medA / medB) * 100

  if (modeA.length <= 1 || modeB.length <= 1) {
    return {
      lower: pointEstimate,
      upper: pointEstimate,
      confidenceLevel,
      resamples,
      pointEstimate,
    }
  }

  const rng = mulberry32(seed)
  const nA = modeA.length
  const nB = modeB.length
  const reductions: number[] = []

  for (let i = 0; i < resamples; i++) {
    const resampleA: number[] = []
    for (let j = 0; j < nA; j++) {
      resampleA.push(modeA[Math.floor(rng() * nA)] ?? 0)
    }
    const resampleB: number[] = []
    for (let j = 0; j < nB; j++) {
      resampleB.push(modeB[Math.floor(rng() * nB)] ?? 0)
    }
    const sA = statistic(resampleA)
    const sB = statistic(resampleB)
    const reduction = sB === 0 ? 0 : (1 - sA / sB) * 100
    reductions.push(reduction)
  }

  reductions.sort((a, b) => a - b)

  const alpha = 1 - confidenceLevel
  const lowerIdx = Math.floor((alpha / 2) * resamples)
  const upperIdx = Math.floor((1 - alpha / 2) * resamples) - 1

  const lower = reductions[Math.max(0, lowerIdx)] ?? pointEstimate
  const upper = reductions[Math.min(resamples - 1, upperIdx)] ?? pointEstimate

  return { lower, upper, confidenceLevel, resamples, pointEstimate }
}
