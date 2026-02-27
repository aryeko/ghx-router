# Statistical Utilities

> Back to [main design](./README.md)

---

## Overview

The statistics module provides distribution-free statistical computations
tailored for agent profiling data, which is typically noisy, non-normal, and
small-sample (5-20 iterations per group). All functions are pure and
stateless.

---

## Descriptive Statistics

Computed for every numeric metric per (scenario, mode, model) group:

```typescript
function computeDescriptive(values: readonly number[]): DescriptiveStats

interface DescriptiveStats {
  readonly count: number
  readonly mean: number
  readonly median: number     // p50
  readonly p90: number
  readonly p95: number
  readonly min: number
  readonly max: number
  readonly iqr: number        // Q3 - Q1
  readonly cv: number         // stddev / mean (coefficient of variation)
  readonly stddev: number
}
```

### Percentile Computation

Uses the linear interpolation method (same as NumPy's default):

```
For percentile p (0-100) on sorted array of n values:
  rank = (p / 100) * (n - 1)
  lower = floor(rank)
  upper = ceil(rank)
  weight = rank - lower
  result = values[lower] * (1 - weight) + values[upper] * weight
```

### When to Use Which Statistic

| Statistic | Use For |
|-----------|---------|
| **Median (p50)** | Central tendency -- robust to outliers |
| **p90, p95** | Tail behavior -- "how bad can it get?" |
| **IQR** | Spread -- robust to outliers |
| **CV** | Relative spread -- compare variability across metrics with different units |
| **Mean** | Only for cost aggregation (total cost = mean * count) |

---

## Bootstrap Confidence Intervals

Distribution-free confidence intervals using the bootstrap method. Preferred
over parametric methods because agent profiling data is rarely normal.

```typescript
function bootstrapCI(
  values: readonly number[],
  options?: {
    readonly resamples?: number       // Default: 10000
    readonly confidenceLevel?: number // Default: 0.95
    readonly statistic?: (values: readonly number[]) => number  // Default: median
  },
): ConfidenceInterval

interface ConfidenceInterval {
  readonly lower: number
  readonly upper: number
  readonly confidenceLevel: number
  readonly resamples: number
  readonly pointEstimate: number
}
```

### Algorithm

```
1. Draw `resamples` random samples (with replacement) of size n from values
2. Compute the statistic for each resample
3. Sort the resampled statistics
4. Return the (alpha/2) and (1 - alpha/2) percentiles as CI bounds
   where alpha = 1 - confidenceLevel
```

### Bootstrap for Reduction Percentages

When computing CI for reduction percentages (e.g., "ghx reduces tokens by
34% +/- X"), the bootstrap operates on paired differences:

```typescript
function bootstrapReductionCI(
  modeA: readonly number[],
  modeB: readonly number[],
  options?: BootstrapOptions,
): ConfidenceInterval

// Algorithm:
// 1. For each resample:
//    a. Draw paired indices with replacement
//    b. Compute reduction: (1 - median(A[indices]) / median(B[indices])) * 100
// 2. Return percentile CI on the resampled reductions
```

**Pairing is critical.** Each iteration index is paired across modes for the
same scenario, reducing variance from fixture/timing noise.

---

## Effect Size (Cohen's d)

Quantifies practical significance -- "how big is the difference?" -- not just
statistical significance.

```typescript
function cohensD(
  groupA: readonly number[],
  groupB: readonly number[],
): EffectSize

interface EffectSize {
  readonly d: number
  readonly magnitude: "negligible" | "small" | "medium" | "large"
}
```

### Computation

```
d = |mean(A) - mean(B)| / pooled_stddev

pooled_stddev = sqrt(((n_A - 1) * var(A) + (n_B - 1) * var(B)) / (n_A + n_B - 2))
```

### Magnitude Thresholds

| d | Magnitude | Interpretation |
|---|-----------|----------------|
| < 0.2 | negligible | No practical difference |
| 0.2 - 0.5 | small | Noticeable but minor |
| 0.5 - 0.8 | medium | Meaningful difference |
| > 0.8 | large | Substantial difference |

---

## Permutation Test

Non-parametric hypothesis test for "is there a real difference between
modes?" Used alongside Cohen's d for completeness.

```typescript
function permutationTest(
  groupA: readonly number[],
  groupB: readonly number[],
  options?: {
    readonly permutations?: number  // Default: 10000
    readonly alternative?: "two-sided" | "less" | "greater"  // Default: "two-sided"
  },
): PermutationResult

interface PermutationResult {
  readonly pValue: number
  readonly observedDifference: number
  readonly permutations: number
}
```

### Algorithm

```
1. Compute observed difference = mean(A) - mean(B)
2. Combine all values into a single pool
3. For each permutation:
   a. Randomly split pool into two groups of size n_A and n_B
   b. Compute difference of means
4. p-value = proportion of permuted differences >= |observed difference|
```

---

## Comparison Pipeline

The full comparison pipeline for two modes:

```
ProfileRow[] for mode A
ProfileRow[] for mode B
    |
    v
For each metric (tokens_active, timing_wall_ms, tool_calls_total, cost_usd):
    |
    +-- Compute DescriptiveStats for A and B
    |
    +-- Compute reduction %: (1 - median(A) / median(B)) * 100
    |
    +-- Bootstrap CI on reduction %
    |
    +-- Cohen's d effect size
    |
    +-- Permutation test p-value
    |
    v
ComparisonResult
    |
    v
Rendered in comparison.md and index.md
```

---

## Minimum Sample Requirements

| Statistic | Minimum Iterations | Recommended |
|-----------|--------------------|-------------|
| Descriptive stats | 3 | 5+ |
| Bootstrap CI | 5 | 10+ |
| Cohen's d | 5 | 10+ |
| Permutation test | 5 | 10+ |
| p90/p95 | 10 | 20+ |

The reporter warns when sample sizes are below recommended minimums and
annotates results accordingly (e.g., "CI computed from 5 samples -- interpret
with caution").
