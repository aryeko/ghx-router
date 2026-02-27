# Design: Eval Missing Features

**Date:** 2026-02-28
**Branch:** `feat/eval-missing-features` (worktree from `main`)
**Spec:** `docs/design/eval/configuration.md`, `docs/design/eval/fixtures.md`

## Problem

Three features required by the eval design spec are unimplemented:

1. `eval fixture seed` -- stub that throws; missing `--seed-id` and `--dry-run` flags
2. `eval analyze` -- stub that prints "not yet implemented"
3. `eval report` -- stub that prints "not yet implemented"

## Feature 1: `eval fixture seed`

### CLI Interface

```
eval fixture seed [options]

Options:
  --repo <owner/name>      Target fixture repo (required)
  --manifest <path>        Manifest output path (default: fixtures/latest.json)
  --seed-id <id>           Seed identifier for labeling (default: "default")
  --dry-run                Show what would be created without touching GitHub
  --config <path>          Eval config file (default: config/eval.config.yaml)
```

### Implementation

**FixtureManager changes:**

- Constructor accepts `seedId: string` parameter
- `seed(scenarios: readonly EvalScenario[])` replaces current stub:
  1. Collect unique `fixture.requires` entries across all scenarios
  2. For each required fixture, delegate to a `FixtureSeeder` based on resource type
  3. Label all created resources with `bench-fixture`
  4. Build `FixtureManifest` with `seedId`, timestamp, repo, and all fixture records
  5. Write manifest via `writeFixtureManifest()`

**FixtureSeeder interface:**

```typescript
interface FixtureSeeder {
  readonly type: string
  seed(repo: string, name: string, labels: readonly string[]): Promise<FixtureResource>
}
```

Two built-in seeders:

- `PrSeeder` -- creates a branch, commits a placeholder file, opens a PR via `gh pr create`
- `IssueSeeder` -- creates an issue via `gh issue create`

Both use the `gh` CLI (consistent with the rest of ghx) and record `originalSha` in metadata for reset support.

**Dry-run mode:** Runs the full scenario collection and requirement dedup, prints the plan (fixture name, type, repo) to stdout, then exits without creating resources.

**CLI wiring (`fixture.ts`):**

- Parse `--seed-id` and `--dry-run` flags
- Load config to find scenarios directory
- Load scenarios via `loadEvalScenarios()`
- Pass scenarios to `fixtureManager.seed()`

### Files

| File | Action |
|------|--------|
| `src/cli/fixture.ts` | Add `--seed-id`, `--dry-run`, `--config` parsing; wire to manager |
| `src/fixture/manager.ts` | Implement `seed()`, accept `seedId` in constructor |
| `src/fixture/seeders/pr-seeder.ts` | New -- creates branch + PR via `gh` |
| `src/fixture/seeders/issue-seeder.ts` | New -- creates issue via `gh` |
| `src/fixture/seeders/index.ts` | New -- seeder registry by type |

## Feature 2: `eval analyze`

### CLI Interface

```
eval analyze [options]

Options:
  --run-dir <path>         Path to report folder with exported sessions (default: results)
  --results <path>         Path to results JSONL file
  --output <path>          Output analysis directory (default: {run-dir}/analysis)
```

### Implementation

The analyze command is a CLI harness that wires agent-profiler's 5 built-in analyzers to exported session traces.

**Flow:**

1. Discover session trace files at `{run-dir}/sessions/{scenarioId}/{mode}-iter-{n}.json`
2. Load `ProfileRow` records from `--results` JSONL to get scenario metadata
3. For each trace, run all 5 analyzers: `reasoning`, `strategy`, `efficiency`, `toolPattern`, `error`
4. Collect results into `SessionAnalysisBundle` per session
5. Write each bundle to `{output}/{scenarioId}/{mode}-iter-{n}-analysis.json`
6. Print summary to stdout (analyzer counts, findings count)

**Scenario reconstruction:** Analyzers need a `BaseScenario` parameter. Reconstruct from the `ProfileRow` metadata (scenarioId, mode) -- the trace itself contains enough context. Use a minimal `{ id, name, description, prompt, timeoutMs }` stub built from the row fields.

**No custom eval analyzers in v1.** The 5 built-in profiler analyzers cover reasoning, strategy, efficiency, tool patterns, and errors. Eval-specific analyzers (e.g., ghx capability usage patterns) can be added later.

### Files

| File | Action |
|------|--------|
| `src/cli/analyze.ts` | Replace stub with full implementation |
| `src/analysis/run-analyzers.ts` | New -- core logic: load traces, run analyzers, write bundles |

## Feature 3: `eval report`

### CLI Interface

```
eval report [options]

Options:
  --run-dir <path>         Path to existing results (default: results)
  --results <path>         Path to results JSONL (repeatable)
  --format <fmt>           Output: all | md | csv | json (default: all)
  --output-dir <path>      Override report output directory
```

### Implementation

Thin CLI wrapper around agent-profiler's `generateReport()`.

**Flow:**

1. Load `ProfileRow[]` from JSONL file(s) via `readJsonlFile()`
2. Check for analysis bundles at `{run-dir}/analysis/` -- load if present
3. Extract `runId` from the run manifest at `{run-dir}/manifest.json` or first ProfileRow
4. Call `generateReport({ runId, rows, reportsDir, analysisResults })`
5. If `--format` is not `all`, delete unwanted output files after generation
6. Print report directory path to stdout

**No eval-specific report extensions.** The profiler's `generateReport()` is a closed function with a fixed page set. Eval-specific data flows through indirectly:
- `GhxCollector` metrics appear in `ProfileRow.extensions` -> metrics page
- `CheckpointScorer` results appear in `ProfileRow.checkpointDetails` -> scenario pages

**Format filtering:** `generateReport()` always produces all formats. For `--format md`, delete `data/results.csv` and `data/results.json` after generation. This is simpler than forking the orchestrator.

### Files

| File | Action |
|------|--------|
| `src/cli/report.ts` | Replace stub with full implementation |
| `src/report/generate.ts` | New -- load data, call generateReport(), filter output |

## Testing Strategy

All three features need unit and integration tests:

| Feature | Unit Tests | Integration Tests |
|---------|-----------|-------------------|
| fixture seed | Seeder logic with mocked `gh` CLI | Full seed + manifest write with fixture repo |
| analyze | Analyzer wiring with mock traces | Load real trace files, run analyzers, verify output |
| report | Data loading, format filtering | Full JSONL -> report generation |

`gh` CLI calls in seeders should be extracted behind a thin shell executor interface for testability.

## Dependencies

- `@ghx-dev/agent-profiler` exports: `generateReport`, `readJsonlFile`, all 5 analyzers, `ProfileRow`, `SessionTrace`, `SessionAnalysisBundle`
- `gh` CLI for fixture seeding (already a runtime dependency of `@ghx-dev/core`)
- No new npm dependencies required
