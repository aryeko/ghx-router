# Configuration Reference

> Back to [main design](./README.md)

---

## Overview

The profiler is configured via a YAML file that defines the profiling matrix.
The config schema is generic -- it does not contain domain-specific fields.
Consumers extend the config with their own sections.

---

## Profiler Config Schema

```yaml
# Modes to compare
modes:
  - mode-a
  - mode-b
  - mode-c

# Scenario selection
scenarios:
  set: default
  # ids:                    # Or explicit scenario IDs (overrides set)
  #   - scenario-a

# Execution parameters
execution:
  repetitions: 5
  warmup: true
  timeout_default_ms: 120000

# Output configuration
output:
  results_dir: results
  reports_dir: reports
  session_export: true
  log_level: info
```

### TypeScript Schema

```typescript
interface ProfilerConfig {
  /** Modes to compare (passed to ModeResolver) */
  readonly modes: readonly string[]

  /** Scenario selection */
  readonly scenarios: {
    /** Named scenario set (from scenario-sets file) */
    readonly set?: string
    /** Explicit scenario IDs (overrides set) */
    readonly ids?: readonly string[]
  }

  /** Execution parameters */
  readonly execution: {
    /** Number of iterations per (scenario, mode) */
    readonly repetitions: number
    /** Run a warmup canary before the real iterations */
    readonly warmup: boolean
    /** Default timeout for agent turns (ms) */
    readonly timeoutDefaultMs: number
  }

  /** Output configuration */
  readonly output: {
    /** Directory for raw results (JSONL) */
    readonly resultsDir: string
    /** Directory for generated reports */
    readonly reportsDir: string
    /** Export full session traces */
    readonly sessionExport: boolean
    /** Log level */
    readonly logLevel: "debug" | "info" | "warn" | "error"
  }

  /** Consumer-specific config sections (passed through) */
  readonly extensions: Readonly<Record<string, unknown>>
}
```

### Extensions Field

Consumers add their own config sections under `extensions`:

```yaml
# Consumer-specific sections (e.g., @ghx-dev/eval)
extensions:
  provider:
    id: opencode
    port: 3001
  models:
    - id: openai/gpt-5.3-codex
      label: Codex 5.3
  fixtures:
    repo: aryeko/ghx-bench-fixtures
    manifest: fixtures/latest.json
```

The profiler passes `extensions` through to consumer code without validation.
Consumers validate their own extension sections.

---

## Environment Variables

| Variable | Config Path | Default |
|----------|-------------|---------|
| `PROFILER_MODES` | `modes` (comma-separated) | -- |
| `PROFILER_REPETITIONS` | `execution.repetitions` | `5` |
| `PROFILER_WARMUP` | `execution.warmup` | `true` |
| `PROFILER_LOG_LEVEL` | `output.log_level` | `info` |

Consumer-specific env vars are not defined by the profiler.

---

## CLI Interface

The profiler exposes a programmatic API, not a CLI. Consumers build their own
CLI that calls the profiler API. However, the profiler provides helper
functions for common CLI patterns:

```typescript
/** Parse profiler-related CLI flags and merge with config file */
function parseProfilerFlags(
  argv: readonly string[],
  configPath: string,
): ProfilerConfig

/** Standard profiler CLI flags */
const PROFILER_FLAGS = {
  "--mode": "Override modes (repeatable)",
  "--scenario": "Override scenarios (repeatable)",
  "--scenario-set": "Override scenario set",
  "--repetitions": "Override repetition count",
  "--skip-warmup": "Skip warmup canary",
  "--output-jsonl": "Write raw JSONL to specific file",
  "--dry-run": "Show what would be executed without running",
} as const
```

---

## Matrix Expansion

The runner expands the config into a flat execution plan:

```
Config:
  modes: [A, B, C]
  scenarios: [S1, S2]
  repetitions: 5

Expansion:
  Mode A: S1 x5, S2 x5
  Mode B: S1 x5, S2 x5
  Mode C: S1 x5, S2 x5

Total iterations: 3 modes x 2 scenarios x 5 repetitions = 30
```

Execution order: **modes -> scenarios -> repetitions** (outermost to
innermost). Modes run sequentially to allow provider reuse. Scenarios run
sequentially within a mode to avoid resource conflicts.

The profiler does not know about "models" -- that is a consumer concept. If
the consumer wants multi-model support, they invoke `runProfileSuite()`
multiple times with different provider configurations.

---

## Warmup

Before the real iteration loop begins, the runner executes the first scenario
once in a throwaway iteration. This serves two purposes:

1. **Prime caches** -- provider connections, model warm-up, and any lazy
   initialization complete before timing starts.
2. **Verify connectivity** -- if the provider or agent is misconfigured, the
   warmup fails fast with a clear error before committing to the full matrix.

The warmup row is discarded from results and does not appear in reports.

**Configuration:**

```yaml
execution:
  warmup: true   # default
```

**CLI override:**

```
--skip-warmup    # skip warmup canary (useful for rapid iteration)
```

When `warmup: false` or `--skip-warmup` is set, the runner proceeds directly
to the first real iteration. This is useful during development but not
recommended for final benchmarking runs, as the first iteration may show
inflated latency due to cold-start effects.
