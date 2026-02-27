/** Token usage broken down by category for a single prompt execution. */
export interface TokenBreakdown {
  /** Tokens consumed from the input/prompt. */
  readonly input: number
  /** Tokens produced in the model output. */
  readonly output: number
  /** Tokens consumed by extended reasoning (e.g., chain-of-thought). */
  readonly reasoning: number
  /** Tokens served from the prompt cache (read hits). */
  readonly cacheRead: number
  /** Tokens written into the prompt cache. */
  readonly cacheWrite: number
  /** Sum of all token categories. */
  readonly total: number
  /** Non-cached tokens that were actively processed (input + output + reasoning). */
  readonly active: number
}

/** Wall-clock timing data with optional named segments. */
export interface TimingBreakdown {
  /** Total elapsed wall-clock time in milliseconds. */
  readonly wallMs: number
  /** Named sub-segments of the overall timing. */
  readonly segments: readonly TimingSegment[]
}

/** A named time interval within a larger timing measurement. */
export interface TimingSegment {
  /** Human-readable label for this segment. */
  readonly label: string
  /** Start of the segment as milliseconds since the Unix epoch. */
  readonly startMs: number
  /** End of the segment as milliseconds since the Unix epoch. */
  readonly endMs: number
}

/** Monetary cost breakdown for a single prompt execution in USD. */
export interface CostBreakdown {
  /** Total cost in USD across all token categories. */
  readonly totalUsd: number
  /** Cost attributable to input tokens in USD. */
  readonly inputUsd: number
  /** Cost attributable to output tokens in USD. */
  readonly outputUsd: number
  /** Cost attributable to reasoning tokens in USD. */
  readonly reasoningUsd: number
}

/** Record of a single tool invocation made during an agent session. */
export interface ToolCallRecord {
  /** Name of the tool that was called. */
  readonly name: string
  /** Logical category the tool belongs to (e.g., "file", "search"). */
  readonly category: string
  /** Whether the tool call completed successfully. */
  readonly success: boolean
  /** Elapsed time for the tool call in milliseconds, or null if unavailable. */
  readonly durationMs: number | null
  /** Error message if the tool call failed. */
  readonly error?: string
}

/** Summary statistics computed over a set of numeric samples. */
export interface DescriptiveStats {
  /** Number of samples in the dataset. */
  readonly count: number
  /** Arithmetic mean of the samples. */
  readonly mean: number
  /** 50th percentile (median) of the samples. */
  readonly median: number
  /** 90th percentile of the samples. */
  readonly p90: number
  /** 95th percentile of the samples. */
  readonly p95: number
  /** Minimum value observed. */
  readonly min: number
  /** Maximum value observed. */
  readonly max: number
  /** Interquartile range (p75 - p25). */
  readonly iqr: number
  /** Coefficient of variation (stddev / mean); 0 if mean is zero. */
  readonly cv: number
  /** Sample standard deviation. */
  readonly stddev: number
}

/** Statistical comparison result between two execution modes on a single metric. */
export interface ComparisonResult {
  /** Identifier of the first mode (treated as the candidate). */
  readonly modeA: string
  /** Identifier of the second mode (treated as the baseline). */
  readonly modeB: string
  /** Name of the metric being compared. */
  readonly metric: string
  /** Median reduction of modeA relative to modeB as a percentage. */
  readonly reductionPct: number
  /** 95% bootstrap confidence interval for the reduction percentage. */
  readonly ci95: readonly [number, number]
  /** Cohen's d effect size (signed, modeA - modeB direction). */
  readonly effectSize: number
  /** Qualitative magnitude of the effect size. */
  readonly effectMagnitude: "negligible" | "small" | "medium" | "large"
  /** Permutation test p-value for the observed difference. */
  readonly pValue: number
}

/** Bootstrap confidence interval for a statistic estimated from resamples. */
export interface ConfidenceInterval {
  /** Lower bound of the confidence interval. */
  readonly lower: number
  /** Upper bound of the confidence interval. */
  readonly upper: number
  /** Confidence level used (e.g., 0.95 for a 95% CI). */
  readonly confidenceLevel: number
  /** Number of bootstrap resamples used to construct the interval. */
  readonly resamples: number
  /** Point estimate of the statistic computed on the original data. */
  readonly pointEstimate: number
}

/** Cohen's d effect size with a qualitative magnitude label. */
export interface EffectSize {
  /** Cohen's d value (signed). */
  readonly d: number
  /** Qualitative interpretation of the effect size magnitude. */
  readonly magnitude: "negligible" | "small" | "medium" | "large"
}

/** Result of a permutation test for the difference between two groups. */
export interface PermutationResult {
  /** Two-sided p-value computed from the permutation distribution. */
  readonly pValue: number
  /** Observed difference in means between the two groups. */
  readonly observedDifference: number
  /** Number of permutations used to build the null distribution. */
  readonly permutations: number
}

/** A single named metric with a scalar value and measurement unit. */
export interface CustomMetric {
  /** Name of the metric (used as the key in profile row extensions). */
  readonly name: string
  /** Measured value; numeric for aggregation, string for categorical data. */
  readonly value: number | string
  /** Unit of measurement (e.g., "ms", "tokens", "usd", "count"). */
  readonly unit: string
}
