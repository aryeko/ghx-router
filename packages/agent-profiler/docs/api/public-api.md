# Public API


Reference for all exported functions, classes, types, and constants from `@ghx-dev/agent-profiler`.

**Source:** `packages/agent-profiler/src/index.ts`

## Import

```typescript
import {
  runProfileSuite,
  generateReport,
  computeDescriptive,
  bootstrapCI,
  cohensD,
  permutationTest,
  loadConfig,
  parseProfilerFlags,
  createLogger,
  // ... see full list below
} from "@ghx-dev/agent-profiler"
```

## Runner

The runner orchestrates scenario execution across modes and iterations, producing `ProfileRow` records.

### runProfileSuite

```typescript
function runProfileSuite(options: ProfileSuiteOptions): Promise<ProfileSuiteResult>
```

Execute a full profiling suite. Iterates over the configured scenarios, modes, and repetition count, collecting metrics via registered collectors and evaluating checkpoints via the scorer.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `ProfileSuiteOptions` | Suite configuration including scenarios, modes, collectors, and run hooks |

**Returns:** `Promise<ProfileSuiteResult>` containing all `ProfileRow` records and optional analysis output.

### ProfileSuiteOptions

Configuration passed to `runProfileSuite`.

### ProfileSuiteResult

Result returned by `runProfileSuite`, containing the collected rows and any post-run analysis.

## Reporter

### generateReport

```typescript
function generateReport(options: ReportOptions): Promise<string>
```

Generate a multi-page Markdown report from profiling results. Writes report files to the configured output directory and returns the directory path.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `ReportOptions` | Report configuration including result rows, output path, and formatting options |

**Returns:** `Promise<string>` -- the report directory path.

### ReportOptions

Configuration passed to `generateReport`.

## Collectors

Collector classes implement the `Collector` contract and gather metrics during each iteration. Register collectors via `ProfileSuiteOptions` to control which metrics the profiler captures.

| Class | Purpose |
|-------|---------|
| `TokenCollector` | Extracts token usage metrics from provider session data |
| `LatencyCollector` | Measures wall-clock latency and timing segments |
| `CostCollector` | Computes cost breakdown from token counts and pricing tables |
| `ToolCallCollector` | Records individual tool invocations, categories, and error rates |

### Usage Example

```typescript
import {
  TokenCollector,
  LatencyCollector,
  CostCollector,
  ToolCallCollector,
  runProfileSuite,
} from "@ghx-dev/agent-profiler"

const result = await runProfileSuite({
  collectors: [
    new TokenCollector(),
    new LatencyCollector(),
    new CostCollector(),
    new ToolCallCollector(),
  ],
  // ... other options
})
```

## Analyzers

Analyzer instances implement the `Analyzer` contract and perform post-iteration or post-suite analysis. They are pre-instantiated singletons.

| Instance | Purpose |
|----------|---------|
| `reasoningAnalyzer` | Analyzes reasoning token patterns and efficiency |
| `strategyAnalyzer` | Classifies agent strategy from tool call sequences |
| `efficiencyAnalyzer` | Measures token-to-outcome efficiency ratios |
| `toolPatternAnalyzer` | Detects tool usage patterns and anti-patterns |
| `errorAnalyzer` | Categorizes errors by type and frequency |

### Usage Example

```typescript
import { reasoningAnalyzer, efficiencyAnalyzer } from "@ghx-dev/agent-profiler"

const reasoning = reasoningAnalyzer.analyze(profileRow)
const efficiency = efficiencyAnalyzer.analyze(profileRow)
```

## Statistics Functions

Pure functions for computing descriptive statistics, confidence intervals, effect sizes, and hypothesis tests across profiling results.

### computeDescriptive

```typescript
function computeDescriptive(values: number[]): DescriptiveStats
```

Compute descriptive statistics (mean, median, percentiles, spread) from a numeric sample. See [`DescriptiveStats`](./metric-types.md#descriptivestats) for the return type.

### bootstrapCI

```typescript
function bootstrapCI(values: number[], options?: BootstrapCIOptions): ConfidenceInterval
```

Compute a bootstrap confidence interval for the median of a single sample. See [`ConfidenceInterval`](./metric-types.md#confidenceinterval) for the return type.

### bootstrapReductionCI

```typescript
function bootstrapReductionCI(
  modeA: number[],
  modeB: number[],
  options?: BootstrapCIOptions,
): ConfidenceInterval
```

Compute a bootstrap confidence interval for the median reduction percentage between two groups (modeA as candidate, modeB as baseline).

### cohensD

```typescript
function cohensD(groupA: number[], groupB: number[]): EffectSize
```

Compute Cohen's d effect size between two groups. See [`EffectSize`](./metric-types.md#effectsize) for the return type.

### permutationTest

```typescript
function permutationTest(
  groupA: number[],
  groupB: number[],
  options?: PermutationTestOptions,
): PermutationResult
```

Run a permutation test for difference in means between two groups. See [`PermutationResult`](./metric-types.md#permutationresult) for the return type.

### compareGroups

```typescript
function compareGroups(
  modeA: string,
  modeAValues: number[],
  modeB: string,
  modeBValues: number[],
  metric: string,
  options?: CompareGroupsOptions,
): ComparisonResult
```

Run a full statistical comparison between two mode groups on a single metric, combining bootstrap CI, Cohen's d, and permutation test. See [`ComparisonResult`](./metric-types.md#comparisonresult) for the return type.

## Configuration

### loadConfig

```typescript
function loadConfig(yamlPath: string): Promise<ProfilerConfig>
```

Load and validate a profiler configuration from a YAML file. Returns a fully validated `ProfilerConfig` object.

### parseProfilerFlags

```typescript
function parseProfilerFlags(argv: readonly string[], base: ProfilerConfig): ProfilerConfig
```

Apply CLI flag overrides on top of a base configuration. Flags take precedence over YAML values.

### PROFILER_FLAGS

```typescript
const PROFILER_FLAGS: {
  readonly "--mode": "Override modes (repeatable)"
  readonly "--scenario": "Override scenarios (repeatable)"
  readonly "--scenario-set": "Override scenario set"
  readonly "--repetitions": "Override repetition count"
  readonly "--retries": "Override allowed retries per iteration"
  readonly "--skip-warmup": "Skip warmup canary"
}
```

Narrow `as const` object mapping the 6 supported CLI flag names to their description strings, used for help text generation.

### ProfilerConfigSchema

```typescript
const ProfilerConfigSchema: ZodSchema<ProfilerConfig>
```

Zod validation schema for `ProfilerConfig`. Use this to validate configuration objects programmatically.

### ProfilerConfig

The validated configuration type. Defines scenarios, modes, repetitions, collectors, output paths, and all tuning parameters.

## Store

Functions for reading and writing JSONL result files and run manifests.

| Function | Signature | Description |
|----------|-----------|-------------|
| `appendJsonlLine` | `(path: string, data: unknown) => Promise<void>` | Append a single JSON line to a JSONL file |
| `parseJsonlLines` | `<T>(content: string, parse: (line: string) => T) => readonly T[]` | Parse a JSONL string into an array of typed values |
| `readJsonlFile` | `<T>(filePath: string, parse: (line: string) => T) => Promise<readonly T[]>` | Read and parse a JSONL file |
| `writeJsonlFile` | `(path: string, data: unknown[]) => Promise<void>` | Write an array of objects as a JSONL file |
| `readManifest` | `(path: string) => Promise<RunManifest>` | Read a run manifest from disk |
| `updateManifest` | `(path: string, updates: Partial<RunManifest>) => Promise<RunManifest>` | Merge updates into an existing manifest |
| `writeManifest` | `(path: string, manifest: RunManifest) => Promise<void>` | Write a complete run manifest |

### RunManifest

Type describing the structure of a run manifest file, which tracks run metadata and file locations.

## Logger

### createLogger

```typescript
function createLogger(level: LogLevel): Logger
```

Create a structured logger at the specified level.

### Logger

The logger interface with methods for each log level.

### LogLevel

```typescript
type LogLevel = "debug" | "info" | "warn" | "error"
```

## Constants

Default values used throughout the profiler when configuration does not specify overrides.

| Constant | Description |
|----------|-------------|
| `DEFAULT_REPETITIONS` | Default number of iterations per scenario-mode pair |
| `DEFAULT_TIMEOUT_MS` | Default per-iteration timeout in milliseconds |
| `DEFAULT_WARMUP` | Default for whether a warmup canary iteration is performed |
| `DEFAULT_RESULTS_DIR` | Default directory path for raw JSONL result files |
| `DEFAULT_REPORTS_DIR` | Default directory path for generated reports |
| `DEFAULT_SESSION_EXPORT` | Default for whether full session traces are exported |
| `DEFAULT_BOOTSTRAP_RESAMPLES` | Default number of bootstrap resamples for CI computation |
| `DEFAULT_PERMUTATION_COUNT` | Default number of permutations for hypothesis tests |
| `DEFAULT_CONFIDENCE_LEVEL` | Default confidence level for intervals (0.95) |
| `DEFAULT_LOG_LEVEL` | Default log level |

## Contract Types

Type-only exports that define the plugin contracts and internal data shapes. These types are not instantiated directly but are implemented by collectors, analyzers, providers, and scorers.

| Type | Description |
|------|-------------|
| `SessionProvider` | Contract for agent session providers |
| `CreateSessionParams` | Parameters for creating a new agent session |
| `SessionHandle` | Handle to an active agent session |
| `PromptResult` | Result returned from a session prompt |
| `ProviderConfig` | Provider-level configuration |
| `PermissionConfig` | Permission settings for sessions |
| `Scorer` | Contract for checkpoint evaluation |
| `ScorerContext` | Context passed to the scorer during evaluation |
| `ScorerResult` | Result of scorer evaluation |
| `ScorerCheckResult` | Per-checkpoint outcome from scorer |
| `Collector` | Contract for metric collection |
| `Analyzer` | Contract for post-run analysis |
| `ModeResolver` | Contract for resolving execution modes |
| `ModeConfig` | Mode definition within a profiler config |
| `RunHooks` | Lifecycle hooks for before/after run, iteration, and suite |
| `AfterScenarioContext` | Context passed to after-scenario hooks |
| `BeforeScenarioContext` | Context passed to before-scenario hooks |
| `RunContext` | Context available throughout a profiling run |
| `BaseScenario` | Base scenario definition |
| `ScenarioLoader` | Contract for loading scenarios from external sources |
| `ScenarioSets` | Named sets of scenario IDs |
| `ProgressEvent` | Event emitted during suite progress |
| `TraceEvent` | Structured trace event for debugging |
| `SessionTrace` | Full trace of a session |
| `Turn` | Single turn within a session trace |
| `AnalysisFinding` | Individual finding from an analyzer |
| `AnalysisResult` | Complete result from an analyzer |
| `SessionAnalysisBundle` | Bundle of analysis results for a session |
| `ProfileRow` | Primary data record (see [ProfileRow Type Reference](./profile-row.md)) |
| `CheckpointResult` | Per-checkpoint outcome (see [ProfileRow Type Reference](./profile-row.md#checkpointresult)) |
| `TokenBreakdown` | Token usage breakdown (see [Metric Types](./metric-types.md#tokenbreakdown)) |
| `TimingBreakdown` | Timing breakdown (see [Metric Types](./metric-types.md#timingbreakdown)) |
| `TimingSegment` | Individual timing segment within a breakdown |
| `CostBreakdown` | Cost breakdown (see [Metric Types](./metric-types.md#costbreakdown)) |
| `ToolCallRecord` | Tool call record (see [Metric Types](./metric-types.md#toolcallrecord)) |
| `DescriptiveStats` | Descriptive statistics (see [Metric Types](./metric-types.md#descriptivestats)) |
| `ComparisonResult` | Mode comparison result (see [Metric Types](./metric-types.md#comparisonresult)) |
| `ConfidenceInterval` | Bootstrap CI (see [Metric Types](./metric-types.md#confidenceinterval)) |
| `EffectSize` | Effect size (see [Metric Types](./metric-types.md#effectsize)) |
| `PermutationResult` | Permutation test result (see [Metric Types](./metric-types.md#permutationresult)) |
| `CustomMetric` | Custom metric (see [Metric Types](./metric-types.md#custommetric)) |

## Related Documentation

- [Quick Start](../getting-started/quick-start.md) -- run your first profiling suite
- [Plugin Contracts](../architecture/plugin-contracts.md) -- detailed contract documentation for `SessionProvider`, `Collector`, `Analyzer`, and `Scorer`
- [Configuration Guide](../guides/configuration.md) -- YAML configuration reference and CLI flag details
