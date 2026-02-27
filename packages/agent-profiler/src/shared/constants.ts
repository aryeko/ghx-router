/** Default number of repetitions per scenario per mode when not specified in config. */
export const DEFAULT_REPETITIONS = 5
/** Default per-scenario timeout in milliseconds when not specified in config or scenario. */
export const DEFAULT_TIMEOUT_MS = 120_000
/** Default for whether a warmup canary iteration is performed before the main suite. */
export const DEFAULT_WARMUP = true
/** Default minimum log level for profiler output. */
export const DEFAULT_LOG_LEVEL = "info" as const
/** Default directory path for raw JSONL result files relative to the working directory. */
export const DEFAULT_RESULTS_DIR = "results"
/** Default directory path for generated reports relative to the working directory. */
export const DEFAULT_REPORTS_DIR = "reports"
/** Default for whether full session traces are exported after each iteration. */
export const DEFAULT_SESSION_EXPORT = true
/** Default number of bootstrap resamples used when computing confidence intervals. */
export const DEFAULT_BOOTSTRAP_RESAMPLES = 10_000
/** Default number of permutations used in permutation significance tests. */
export const DEFAULT_PERMUTATION_COUNT = 10_000
/** Default confidence level for bootstrap confidence intervals (0.95 = 95%). */
export const DEFAULT_CONFIDENCE_LEVEL = 0.95
/** Default number of times to retry a failed iteration (0 = no retries). */
export const DEFAULT_ALLOWED_RETRIES = 0
