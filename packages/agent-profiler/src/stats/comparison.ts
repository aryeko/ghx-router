import { DEFAULT_PERMUTATION_COUNT } from "@profiler/shared/constants.js"
import type { ComparisonResult, EffectSize, PermutationResult } from "@profiler/types/metrics.js"
import type { BootstrapCIOptions } from "./bootstrap.js"
import { bootstrapReductionCI } from "./bootstrap.js"

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

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((acc, v) => acc + v, 0) / values.length
}

function variance(values: readonly number[], m: number): number {
  if (values.length <= 1) return 0
  return values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1)
}

export function cohensD(groupA: readonly number[], groupB: readonly number[]): EffectSize {
  const nA = groupA.length
  const nB = groupB.length

  if (nA === 0 || nB === 0) {
    return { d: 0, magnitude: "negligible" }
  }

  const meanA = mean(groupA)
  const meanB = mean(groupB)
  const varA = variance(groupA, meanA)
  const varB = variance(groupB, meanB)

  const denominator = nA + nB - 2
  const pooledStddev =
    denominator <= 0 ? 0 : Math.sqrt(((nA - 1) * varA + (nB - 1) * varB) / denominator)

  const d = pooledStddev === 0 ? 0 : (meanA - meanB) / pooledStddev

  const absD = Math.abs(d)
  const magnitude: EffectSize["magnitude"] =
    absD < 0.2 ? "negligible" : absD < 0.5 ? "small" : absD < 0.8 ? "medium" : "large"

  return { d, magnitude }
}

export interface PermutationTestOptions {
  readonly permutations?: number
  readonly alternative?: "two-sided" | "less" | "greater"
  readonly seed?: number
}

export function permutationTest(
  groupA: readonly number[],
  groupB: readonly number[],
  options?: PermutationTestOptions,
): PermutationResult {
  const permutations = options?.permutations ?? DEFAULT_PERMUTATION_COUNT
  const alternative = options?.alternative ?? "two-sided"
  const seed = options?.seed ?? 42

  if (groupA.length === 0 || groupB.length === 0) {
    return { pValue: 1.0, observedDifference: 0, permutations }
  }

  const observedDifference = mean(groupA) - mean(groupB)
  const pooled = [...groupA, ...groupB]
  const nA = groupA.length
  const rng = mulberry32(seed)

  let count = 0

  for (let i = 0; i < permutations; i++) {
    // Fisher-Yates shuffle
    const shuffled = [...pooled]
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1))
      const tmp = shuffled[j] ?? 0
      shuffled[j] = shuffled[k] ?? 0
      shuffled[k] = tmp
    }

    const permA = shuffled.slice(0, nA)
    const permB = shuffled.slice(nA)
    const permDiff = mean(permA) - mean(permB)

    if (alternative === "two-sided") {
      if (Math.abs(permDiff) >= Math.abs(observedDifference)) count++
    } else if (alternative === "less") {
      if (permDiff <= observedDifference) count++
    } else {
      if (permDiff >= observedDifference) count++
    }
  }

  const pValue = count / permutations

  return { pValue, observedDifference, permutations }
}

export interface CompareGroupsOptions {
  readonly bootstrapOptions?: BootstrapCIOptions
  readonly permutationOptions?: PermutationTestOptions
}

export function compareGroups(
  modeA: string,
  modeAValues: readonly number[],
  modeB: string,
  modeBValues: readonly number[],
  metric: string,
  options?: CompareGroupsOptions,
): ComparisonResult {
  const ci = bootstrapReductionCI(modeAValues, modeBValues, options?.bootstrapOptions)
  const effect = cohensD(modeAValues, modeBValues)
  const perm = permutationTest(modeAValues, modeBValues, options?.permutationOptions)

  return {
    modeA,
    modeB,
    metric,
    reductionPct: ci.pointEstimate,
    ci95: [ci.lower, ci.upper] as const,
    effectSize: effect.d,
    effectMagnitude: effect.magnitude,
    pValue: perm.pValue,
  }
}
