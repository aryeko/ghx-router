import { DEFAULT_PERMUTATION_COUNT } from "@profiler/shared/constants.js"
import type { ComparisonResult, EffectSize, PermutationResult } from "@profiler/types/metrics.js"
import type { BootstrapCIOptions } from "./bootstrap.js"
import { bootstrapReductionCI } from "./bootstrap.js"
import { mulberry32 } from "./prng.js"

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((acc, v) => acc + v, 0) / values.length
}

function variance(values: readonly number[], m: number): number {
  if (values.length <= 1) return 0
  return values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1)
}

/**
 * Compute Cohen's d effect size between two independent groups.
 *
 * Uses the pooled standard deviation (Welch-style denominator). Returns a
 * negligible effect size when either group is empty or the pooled standard
 * deviation is zero.
 *
 * @param groupA - Numeric samples for the first group (candidate).
 * @param groupB - Numeric samples for the second group (baseline).
 * @returns Cohen's d value with a qualitative magnitude label.
 */
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

/** Options for configuring a permutation test. */
export interface PermutationTestOptions {
  /** Number of permutations to generate for the null distribution (defaults to DEFAULT_PERMUTATION_COUNT). */
  readonly permutations?: number
  /** Directionality of the test hypothesis (defaults to "two-sided"). */
  readonly alternative?: "two-sided" | "less" | "greater"
  /** Random seed for reproducible shuffling (defaults to 42). */
  readonly seed?: number
}

/**
 * Perform a permutation test for the difference in means between two groups.
 *
 * Builds a null distribution by repeatedly shuffling the pooled samples and
 * computing the mean difference. The p-value is the fraction of permutations
 * that are at least as extreme as the observed difference.
 *
 * @param groupA - Numeric samples for the first group.
 * @param groupB - Numeric samples for the second group.
 * @param options - Optional configuration for permutation count, alternative, and seed.
 * @returns The p-value, observed mean difference, and number of permutations used.
 */
export function permutationTest(
  groupA: readonly number[],
  groupB: readonly number[],
  options?: PermutationTestOptions,
): PermutationResult {
  const permutations = options?.permutations ?? DEFAULT_PERMUTATION_COUNT
  const alternative = options?.alternative ?? "two-sided"
  const seed = options?.seed ?? 42

  if (permutations === 0) {
    return { pValue: 1.0, observedDifference: 0, permutations: 0 }
  }

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

/** Options for configuring a full group comparison. */
export interface CompareGroupsOptions {
  /** Options forwarded to the bootstrap CI computation. */
  readonly bootstrapOptions?: BootstrapCIOptions
  /** Options forwarded to the permutation test computation. */
  readonly permutationOptions?: PermutationTestOptions
}

/**
 * Compare two groups of numeric samples for a single metric and produce a full statistical summary.
 *
 * Combines a bootstrap reduction confidence interval, Cohen's d effect size, and a
 * permutation test p-value into a single ComparisonResult.
 *
 * @param modeA - Identifier of the first (candidate) mode.
 * @param modeAValues - Numeric samples for modeA.
 * @param modeB - Identifier of the second (baseline) mode.
 * @param modeBValues - Numeric samples for modeB.
 * @param metric - Name of the metric being compared.
 * @param options - Optional configuration for bootstrap and permutation computations.
 * @returns A ComparisonResult with reduction percentage, CI, effect size, and p-value.
 */
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
