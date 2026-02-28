# Running Evaluations

CLI commands, flags, and interpreting output.

## Commands Overview

| Command | Purpose |
|---------|---------|
| `eval run` | Execute evaluation scenarios across modes and models |
| `eval analyze` | Re-analyze exported session traces post-hoc |
| `eval report` | Generate reports from results data |
| `eval check` | Validate config and scenario files |
| `eval fixture` | Manage GitHub test fixtures |

All commands are run via:

```bash
pnpm --filter @ghx-dev/eval run eval <command> [options]
```

## `eval run`

Execute the full evaluation matrix (models x modes x scenarios x repetitions).

```text
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

Repeatable flags (`--mode`, `--scenario`, `--model`) can be specified multiple times:

```bash
pnpm --filter @ghx-dev/eval run eval run \
  --mode ghx --mode mcp \
  --scenario pr-review-comment-001 \
  --repetitions 3
```

### Quick Single-Scenario Test

```bash
pnpm --filter @ghx-dev/eval run eval run \
  --scenario pr-review-comment-001 \
  --repetitions 1 \
  --skip-warmup
```

### Multi-Model Comparison

```bash
pnpm --filter @ghx-dev/eval run eval run \
  --model openai/gpt-5.3-codex \
  --model anthropic/claude-sonnet-4-6 \
  --repetitions 3
```

## `eval analyze`

Run analyzers on exported session traces without generating reports. Useful when analysis is too expensive to run inline, or when re-analyzing with updated analyzer configurations.

```text
eval analyze [options]

Options:
  --run-dir <path>         Path to report folder with exported sessions
  --results <path>         Path to results JSONL file
  --output <path>          Output analysis report path
```

Example:

```bash
pnpm --filter @ghx-dev/eval run eval analyze \
  --run-dir reports/2026-02-27T12-00-00 \
  --results results/run-001.jsonl
```

## `eval report`

Generate Markdown, CSV, and/or JSON reports from results data.

```text
eval report [options]

Options:
  --run-dir <path>         Path to existing results
  --results <path>         Path to results JSONL (repeatable)
  --format <fmt>           Output: all | md | csv | json (default: all)
  --output-dir <path>      Override report output directory
```

Example:

```bash
pnpm --filter @ghx-dev/eval run eval report \
  --results results/run-001.jsonl \
  --format md \
  --output-dir reports/latest
```

## `eval check`

Validate configuration and scenario files without executing anything.

```text
eval check [options]

Options:
  --scenarios              Validate all scenario JSON files
  --config                 Validate eval.config.yaml
  --all                    Validate everything
```

Example:

```bash
pnpm --filter @ghx-dev/eval run eval check --all
```

## `eval fixture`

Manage GitHub test fixtures. See [Managing Fixtures](./managing-fixtures.md) for full details.

```text
eval fixture <command> [options]

Commands:
  seed       Seed fixtures in the target repo
  status     Check fixture status
  cleanup    Remove all fixtures

Options:
  --repo <owner/name>      Target repo (default: from config)
  --manifest <path>        Manifest file path (default: fixtures/latest.json)
  --seed-id <id>           Seed identifier for labeling (default: "default")
  --all                    (cleanup) Discover and remove all bench-fixture resources
```

## Example: Full Evaluation Run

```bash
# Run the default evaluation from config
pnpm --filter @ghx-dev/eval run eval run

# Output:
#   [warmup] Canary scenario passed (2.3s)
#   [model: openai/gpt-5.3-codex]
#     [mode: ghx]
#       pr-review-comment-001: iter 1/5 PASS (8.2s) ... iter 5/5 PASS (7.1s)
#       pr-fix-mixed-threads-wf-001: iter 1/5 PASS (22.4s) ... iter 5/5 PASS (19.8s)
#     [mode: baseline]
#       ...
#     [mode: mcp]
#       ...
#   Results: results/run-001.jsonl (30 rows)
#   Reports: reports/2026-02-27T12-00-00/
```

Results are written to JSONL (one `ProfileRow` per iteration). Reports are generated automatically unless `--dry-run` is specified.

Source: `packages/eval/src/cli/parse-flags.ts`

## Related Documentation

- [Guides Hub](./README.md) -- all available guides
- [Configuration](./configuration.md) -- config file schema and environment variables
- [Reports](./reports.md) -- output directory structure and report formats
- [Interpreting Results](../methodology/interpreting-results.md) -- statistical interpretation of evaluation data
