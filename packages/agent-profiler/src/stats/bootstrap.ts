import {
  DEFAULT_BOOTSTRAP_RESAMPLES,
  DEFAULT_CONFIDENCE_LEVEL,
} from "@profiler/shared/constants.js"
import type { ConfidenceInterval } from "@profiler/types/metrics.js"

function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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

export interface BootstrapCIOptions {
  readonly resamples?: number
  readonly confidenceLevel?: number
  readonly statistic?: (values: readonly number[]) => number
  readonly seed?: number
}

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
