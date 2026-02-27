# Configuration Reference

> Back to [main design](./README.md)

---

## Overview

The eval package configuration extends the profiler's generic config with
ghx-specific sections: provider settings, model definitions, fixture
management, and mode selection.

---

## `eval.config.yaml` Schema

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
  seed_if_missing: false
  reseed_between_modes: false
```

---

## Environment Variables

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

---

## CLI Interface

### `eval run`

```
eval run [options]

Options:
  --config <path>          Config file (default: eval.config.yaml)
  --model <id>             Override model (repeatable)
  --mode <mode>            Override modes (repeatable)
  --scenario <id>          Override scenarios (repeatable)
  --scenario-set <name>    Override scenario set
  --repetitions <n>        Override repetition count
  --skip-warmup            Skip warmup canary
  --output-jsonl <path>    Write raw JSONL to specific file
  --seed-if-missing        Auto-seed fixtures if manifest not found
  --dry-run                Show what would be executed without running
```

**Examples:**

```bash
# Full evaluation from config
pnpm --filter @ghx-dev/eval run eval run

# Quick single-scenario test
pnpm --filter @ghx-dev/eval run eval run \
  --scenario pr-fix-mixed-threads-wf-001 \
  --repetitions 1 \
  --skip-warmup

# Multi-model comparison
pnpm --filter @ghx-dev/eval run eval run \
  --model openai/gpt-5.3-codex \
  --model anthropic/claude-sonnet-4-6 \
  --repetitions 3
```

### `eval analyze`

Runs the analyzer pipeline on exported session traces without generating
reports. Use case: run heavy analyzers (strategy classification, LLM-judge
scoring) post-hoc after a suite completes. This is useful when analysis is
too expensive to run inline during the evaluation loop, or when you want to
re-analyze existing traces with updated analyzer configurations.

```
eval analyze [options]

Options:
  --run-dir <path>         Path to report folder with exported sessions
  --results <path>         Path to results JSONL file
  --output <path>          Output analysis report path
```

### `eval report`

Generates the full evaluation report from results data. If exported session
traces are available in the run directory, `eval report` can optionally
include analysis results (from a prior `eval analyze` run or by running
analyzers inline). Without traces, the report covers metrics and scoring
only.

```
eval report [options]

Options:
  --run-dir <path>         Path to existing results
  --results <path>         Path to results JSONL (repeatable)
  --format <fmt>           Output: all | md | csv | json (default: all)
  --output-dir <path>      Override report output directory
```

### `eval check`

```
eval check [options]

Options:
  --scenarios              Validate all scenario JSON files
  --config                 Validate eval.config.yaml
  --all                    Validate everything
```

### `eval fixture`

```
eval fixture <command> [options]

Commands:
  seed       Seed fixtures in the target repo
  status     Check fixture status
  cleanup    Remove all fixtures

Options:
  --repo <owner/name>      Target repo
  --manifest <path>        Manifest file path
  --all                    (cleanup) Remove all bench-fixture resources
```

---

## Evaluation Matrix Expansion

The eval CLI expands the full evaluation matrix including models (which the
profiler does not handle):

```
Config:
  models: [A, B]
  modes: [ghx, baseline, mcp]
  scenarios: [S1, S2]
  repetitions: 5

Expansion:
  Model A:                      <-- eval CLI outer loop
    Mode ghx:      S1 x5, S2 x5    <-- profiler handles this
    Mode baseline: S1 x5, S2 x5
    Mode mcp:      S1 x5, S2 x5
  Model B:                      <-- eval CLI outer loop
    Mode ghx:      S1 x5, S2 x5
    Mode baseline: S1 x5, S2 x5
    Mode mcp:      S1 x5, S2 x5

Total iterations: 2 models x 3 modes x 2 scenarios x 5 reps = 60
```

Execution order: **models -> modes -> scenarios -> repetitions** (outermost to
innermost). The eval CLI iterates over models; within each model, the profiler
handles modes -> scenarios -> repetitions.
