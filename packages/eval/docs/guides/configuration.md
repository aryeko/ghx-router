# Configuration

Full reference for `eval.config.yaml`, environment variable overrides, and matrix expansion.

## Config File

The eval configuration file extends the profiler's generic config with ghx-specific sections. Default location: `config/eval.config.yaml`.

```yaml
# -- Profiler config (passed through to agent-profiler) --

# Execution modes to compare
modes:
  - ghx
  - baseline
  - mcp

# Scenario selection
scenarios:
  set: default
  # ids:                    # Or explicit scenario IDs (overrides set)
  #   - pr-fix-mixed-threads-wf-001

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

# -- Eval-specific config (extensions) --

# Provider configuration
provider:
  id: opencode
  port: 3001

# Models to evaluate (eval iterates over these, calling profiler per model)
models:
  - id: openai/gpt-5.3-codex
    label: Codex 5.3
  # - id: anthropic/claude-sonnet-4-6
  #   label: Claude Sonnet 4.6

# Fixture configuration
fixtures:
  repo: aryeko/ghx-bench-fixtures
  manifest: fixtures/latest.json
  seed_if_missing: true
  reseed_between_modes: true
```

## Field Reference

### `modes`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `modes` | `string[]` | `["ghx", "baseline"]` | Execution modes to compare. Valid values: `ghx`, `baseline`, `mcp`. |

### `scenarios`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `scenarios.set` | `string` | `"default"` | Named scenario set from `scenarios/scenario-sets.json` |
| `scenarios.ids` | `string[]` | -- | Explicit scenario IDs; overrides `set` when provided |

### `execution`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `execution.repetitions` | `number` | `5` | Number of iterations per mode x scenario combination |
| `execution.warmup` | `boolean` | `true` | Run a warmup canary before the evaluation loop |
| `execution.timeout_default_ms` | `number` | `120000` | Default timeout for scenarios that do not specify their own |

### `output`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `output.results_dir` | `string` | `"results"` | Directory for JSONL result files |
| `output.reports_dir` | `string` | `"reports"` | Directory for generated reports |
| `output.session_export` | `boolean` | `true` | Export full session traces for post-hoc analysis |
| `output.log_level` | `string` | `"info"` | Log verbosity: `debug`, `info`, `warn`, `error` |

### `provider`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider.id` | `string` | `"opencode"` | Session provider identifier |
| `provider.port` | `number` | `3001` | Port for the provider SDK connection |

### `models`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `models[].id` | `string` | -- | Model identifier (e.g. `"openai/gpt-5.3-codex"`) |
| `models[].label` | `string` | -- | Display label for reports |

### `fixtures`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `fixtures.repo` | `string` | -- | Target fixture repository in `"owner/repo"` format |
| `fixtures.manifest` | `string` | `"fixtures/latest.json"` | Path to the fixture manifest file |
| `fixtures.seed_if_missing` | `boolean` | `false` | Auto-seed fixtures if manifest not found |
| `fixtures.reseed_between_modes` | `boolean` | `false` | Reset all fixtures when switching modes |

## Environment Variable Overrides

### Profiler Variables

| Variable | Config Path | Default |
|----------|-------------|---------|
| `PROFILER_MODES` | `modes` (comma-separated) | `ghx,baseline` |
| `PROFILER_REPETITIONS` | `execution.repetitions` | `5` |
| `PROFILER_WARMUP` | `execution.warmup` | `true` |
| `PROFILER_LOG_LEVEL` | `output.log_level` | `info` |

### Eval-Specific Variables

| Variable | Config Path | Default |
|----------|-------------|---------|
| `EVAL_PROVIDER_ID` | `provider.id` | `opencode` |
| `EVAL_PROVIDER_PORT` | `provider.port` | `3001` |
| `EVAL_MODEL` | `models[0].id` | -- |
| `EVAL_FIXTURE_REPO` | `fixtures.repo` | -- |
| `EVAL_FIXTURE_MANIFEST` | `fixtures.manifest` | `fixtures/latest.json` |
| `GH_TOKEN` | -- | Required for GitHub operations |
| `GITHUB_TOKEN` | -- | Alias for `GH_TOKEN` |

Environment variables take precedence over config file values. CLI flags take precedence over both.

## Matrix Expansion

The eval CLI expands the full evaluation matrix: **models x modes x scenarios x repetitions**.

```text
Config:
  models: [A, B]
  modes: [ghx, baseline, mcp]
  scenarios: [S1, S2]
  repetitions: 5

Expansion:
  Model A:                        <-- eval CLI outer loop
    Mode ghx:      S1 x5, S2 x5      <-- profiler handles this
    Mode baseline: S1 x5, S2 x5
    Mode mcp:      S1 x5, S2 x5
  Model B:                        <-- eval CLI outer loop
    Mode ghx:      S1 x5, S2 x5
    Mode baseline: S1 x5, S2 x5
    Mode mcp:      S1 x5, S2 x5

Total iterations: 2 x 3 x 2 x 5 = 60
```

Execution order (outermost to innermost): models -> modes -> scenarios -> repetitions. The eval CLI iterates over models; the profiler handles modes -> scenarios -> repetitions.

For the full matrix diagram, see [Evaluation Design](../methodology/evaluation-design.md).

Source: `packages/eval/config/eval.config.yaml`

## Related Documentation

- [Guides Hub](./README.md) -- all available guides
- [Running Evaluations](./running-evaluations.md) -- CLI commands and flags
- [Evaluation Design](../methodology/evaluation-design.md) -- matrix design and statistical methodology
- [Architecture Overview](../architecture/overview.md) -- how config flows through the system
