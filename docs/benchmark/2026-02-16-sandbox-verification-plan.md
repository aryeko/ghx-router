# Set-by-Set Verification With Benchmark Runner Design Spec

## Objective

Define a set-level verification flow that reuses existing benchmark tooling (`benchmark` +
`report`) and adds strict blocking validation per scenario row.

## Scope

### In Scope

- Add a wrapper CLI in `@ghx-dev/benchmark` to run verification for a single scenario set.
- Reuse existing `benchmark` and `report` commands as the execution backbone.
- Capture per-set artifacts in a deterministic directory layout.
- Enforce blocking validation on produced suite rows.
- Add a multi-set driver script that runs required sets in a fixed order.

### Out of Scope

- Replacing `benchmark` or `report` internals.
- Adding a new benchmark execution pipeline.
- Changing scenario content or scorecard semantics.

## Functional Requirements

1. The wrapper CLI accepts:
   - `--set` (required)
   - `--provider` (required)
   - `--model` (optional, default `gpt-5.1-codex-mini`)
   - `--repetitions` (optional, default `1`)
2. The wrapper CLI runs paired benchmark modes for the requested set and then runs report
   generation.
3. Seeding behavior differs by set:
   - `ci-diagnostics` and `ci-log-analysis` are read-only (no seeding).
   - all other ordered sets run through seed-enabled flow.
4. The wrapper CLI passes explicit per-set output paths so suite and report artifacts are written
   directly into the set-specific directory (no copy/snapshot step).
5. Each set must execute in paired mode (`agent_direct` and `ghx`).
6. Validation blocks the run when any row violates required fields.
7. Any wrapper-generated intermediate paths must be unique per execution to avoid collisions under
   parallel runs.
8. Report summary path support is a hard prerequisite: wrapper implementation cannot proceed until
   `report` supports explicit `--summary-json` and `--summary-md` output flags.
9. Retry behavior is bounded: each failing set allows at most two scenario-level rerun attempts;
   unresolved failures after attempt two are terminal.

## Prerequisite Gate (Must Pass Before Wrapper Work)

Before implementing `verify:set`, satisfy this prerequisite:

1. `report` supports:
   - `--summary-json <path>`
   - `--summary-md <path>`
2. Acceptance command:

```bash
pnpm --filter @ghx-dev/benchmark run report -- --gate --gate-profile verify_pr --summary-json /tmp/verify-summary.json --summary-md /tmp/verify-summary.md
```

3. Required result:
   - command exits `0`
   - both files are written at the exact requested paths
4. If unsupported, implement this report support first and treat it as a blocking predecessor.

## CLI Contracts

The wrapper and called commands must use explicit output and rerun contracts:

- `verify:set`
  - required: `--set`, `--provider`
  - optional: `--model`, `--repetitions`, `--out-dir`
  - `--out-dir` default:
    `packages/benchmark/reports/verification-<date>-<model>-by-set/<set>/`
- paired benchmark runs (invoked by wrapper):
  - `benchmark -- agent_direct ... --provider <provider> --model <model> --output-jsonl <out-dir>/agent_direct-suite.jsonl`
  - `benchmark -- ghx ... --provider <provider> --model <model> --output-jsonl <out-dir>/ghx-suite.jsonl`
- report generation (invoked by wrapper):
  - `report -- --gate --gate-profile verify_pr --summary-json <out-dir>/latest-summary.json --summary-md <out-dir>/latest-summary.md`
- scenario-level rerun contract (for failures):
  - repeatable flag: `--scenario-id <id>`
  - wrapper maps `--scenario-id <id>` to benchmark selector flag `--scenario <id>`
  - wrapper replays paired mode restricted to the provided scenario IDs

Compatibility requirement:

- if `report` does not yet support `--summary-json` and `--summary-md`, add support first;
  wrapper behavior must not depend on copying from shared latest files.

Fixture-health preflight contract:

- Preflight must run exactly once before Set 1:
  - `pnpm --filter @ghx-dev/benchmark run fixtures -- status --out fixtures/latest.json`
- Required preflight result:
  - command exits `0`
  - `fixtures/latest.json` exists and is valid JSON
- If this contract is not currently supported by `fixtures`, add support before wrapper work.

## Validation Rules

For every row in each generated suite JSONL file:

- `success` must be `true`
- `output_valid` must be `true`
- `error` must be `null`

Row count contract:

- each mode file must contain exactly one final row per resolved scenario ID for the set
- zero-row outputs are always treated as terminal failure

If any row fails, the command exits non-zero and reports failing row details.

## Architecture

### Single-Set Wrapper

Primary module:

- `packages/benchmark/src/cli/verify-by-set.ts`

Responsibilities:

1. Parse CLI arguments and normalize model signature.
2. Determine whether the selected set requires seed flow.
3. Build a run identifier and derive per-set output paths.
4. Run paired `benchmark` modes (`agent_direct`, `ghx`) with explicit `--provider` and `--model`
   CLI args plus explicit per-set output JSONL paths.
5. Run `report` with explicit summary output paths scoped to the current set directory.
6. Validate row-level output and return pass/fail status.

### Multi-Set Driver

Driver script:

- `packages/benchmark/scripts/run-verify-by-set.sh`

Execution order:

1. `pr-exec`
2. `pr-thread-mutations`
3. `issues`
4. `release-delivery`
5. `workflows`
6. `projects-v2`
7. `pr-review-reads`
8. `ci-diagnostics`
9. `ci-log-analysis`

The script invokes the single-set wrapper once per set.

## Artifact Layout

Each run writes to:

- `packages/benchmark/reports/verification-<date>-<model>-by-set/<set>/`

Expected generated artifacts:

- `agent_direct-suite.jsonl`
- `ghx-suite.jsonl`
- `latest-summary.json`
- `latest-summary.md`

All artifacts are generated directly in the target set folder; implementation must not depend on
copying from shared `results/` or `reports/` latest files.

Required run identifier convention:

- `<run-id>` is timestamp- or UUID-based and unique per execution.
- `<run-id>` must be included in any intermediate/generated path used by the wrapper.

## Interface and Script Additions

In `packages/benchmark/package.json`:

- `verify:set` -> wrapper CLI entrypoint
- `verify:mini:by-set` -> ordered multi-set driver script

## Operational Notes

- Preflight executes once before Set 1:
  - verify fixture manifest exists (`fixtures/latest.json`) and `fixtures status` is healthy
  - verify required CLI inputs are present (`--provider`, `--model` default or explicit)
  - create run-level base artifact directory
    (`packages/benchmark/reports/verification-<date>-<model>-by-set/`)
- Set execution is strictly blocking by order; no parallel advancement across sets.
- Only advance to the next set when the current set passes blocking row-level validation.
- Row-level gating mode is authoritative for progression; `report --gate --gate-profile verify_pr`
  output is retained for reporting but does not override row-level block status.
- Required environment/runtime context includes benchmark auth prerequisites.
- Wrapper flow must remain a thin orchestrator around existing benchmark commands.
- Error output should prioritize actionable failure details (set name, file, row index, field).
- Intermediate path generation must be parallel-safe; no shared static filenames.
- Artifact and summary writes must be parallel-safe via explicit per-set output paths.

Seed lifecycle requirements:

- preflight validates fixture manifest once before Set 1.
- for sets marked `with seed`, wrapper runs seed-enabled flow for that set with a unique seed ID.
- for read-only sets, wrapper must skip seed creation.
- cleanup runs once at post-run stage after all ordered sets are green (or after terminal stop if
  explicitly requested).

Seed command contract:

- Seed ID format: `<run-id>-<set>-seed`
  - example: `20260216T231045Z-pr-exec-seed`
- Seed creation command for `with seed` sets:
  - `pnpm --filter @ghx-dev/benchmark run fixtures -- seed --seed-id <seed-id> --out <run-base>/fixtures/latest.json`
- For `with seed` sets, wrapper must call the existing fixture-seed command with:
  - `--seed-id <seed-id>`
  - output manifest under the run-scoped base directory
- For read-only sets, wrapper must not invoke seed creation commands.
- Post-run cleanup command:
  - `pnpm --filter @ghx-dev/benchmark run fixtures -- cleanup --out fixtures/latest.json`

## Command Examples

Single-set run:

```bash
pnpm --filter @ghx-dev/benchmark run verify:set -- --set pr-exec --provider openai --model gpt-5.1-codex-mini --repetitions 1
```

Single-set rerun restricted to failures:

```bash
pnpm --filter @ghx-dev/benchmark run verify:set -- --set pr-exec --provider openai --model gpt-5.1-codex-mini --scenario-id pr-review-submit-approve-001 --scenario-id pr-branch-update-001
```

Ordered mini flow:

```bash
pnpm --filter @ghx-dev/benchmark run verify:mini:by-set -- --provider openai --model gpt-5.1-codex-mini --repetitions 1
```

## Set Namespace Mapping

- The ordered execution sets (`pr-exec`, `issues`, etc.) are benchmark scenario-set identifiers.
- Read-only seed policy applies to `ci-diagnostics` and `ci-log-analysis`.
- Implementation must include explicit mapping (or shared classification helper) to avoid
  accidental seed behavior mismatches across naming schemes.

Required mapping table:

| Ordered Set | Seed Policy |
| --- | --- |
| `pr-exec` | with seed |
| `pr-thread-mutations` | with seed |
| `issues` | with seed |
| `release-delivery` | with seed |
| `workflows` | with seed |
| `projects-v2` | with seed |
| `pr-review-reads` | with seed |
| `ci-diagnostics` | read-only (no seed) |
| `ci-log-analysis` | read-only (no seed) |

## Failure and Retry Policy

- On set failure, extract failing `scenario_id` values from validator output.
- Re-run paired mode for failed scenarios to confirm reproducibility.
- Fix harness/fixture/scenario issues as needed.
- Re-run the full set and require a clean blocking validation result before continuing.

Bounded retry contract:

- Maximum scenario-level reruns per set: `2`
- Retry scope: each retry includes only failed `scenario_id` values from the immediately previous
  attempt.
- Terminal stop: if blocking failures remain after attempt 2, mark set `terminal_fail` and stop
  ordered execution.
- Every retry attempt must append to `tracking.json.reruns` with `attempt`, `scenario_ids`, and
  `result`.

## Per-Set Tracking Requirements

For each set, record:

- `rows_expected` vs `rows_actual` for `agent_direct` and `ghx`
- pass/fail counts for `success`, `output_valid`, and `error`
- failing `scenario_id` list
- rerun attempts and final disposition

This tracking can be emitted as a machine-readable file or markdown per set, but must be preserved
in the set artifact directory.

Required file name in each set folder:

- `tracking.json`

Write-on-fail requirement:

- `tracking.json` must be written for every set outcome: `pass`, `fail`, or `terminal_fail`.
- On failure, it must still include computed row counts, failing scenarios, and rerun history up to
  the stop point.

Required tracking source rules:

- `rows_expected` is derived from the resolved scenario list for the set (or rerun filter) before
  execution.
- `rows_actual` is counted from each produced JSONL.
- expected row count for paired mode is `rows_expected` per mode.

Normative scenario-resolution source:

- `rows_expected` must come from the same scenario resolver used by benchmark execution.
- Wrapper must persist resolved IDs in `tracking.json.resolved_scenarios` before execution.
- For reruns with `--scenario-id`, `rows_expected` equals the count of unique rerun IDs after
  resolver normalization.

Example `tracking.json` shape:

```json
{
  "set": "pr-exec",
  "provider": "openai",
  "model": "gpt-5.1-codex-mini",
  "resolved_scenarios": [
    "pr-review-submit-approve-001",
    "pr-branch-update-001"
  ],
  "rows_expected": {
    "agent_direct": 9,
    "ghx": 9
  },
  "rows_actual": {
    "agent_direct": 9,
    "ghx": 9
  },
  "checks": {
    "success": { "pass": 9, "fail": 0 },
    "output_valid": { "pass": 9, "fail": 0 },
    "error_null": { "pass": 9, "fail": 0 }
  },
  "failing_scenarios": [],
  "reruns": [
    {
      "attempt": 1,
      "scenario_ids": [],
      "result": "pass"
    }
  ],
  "final_status": "pass"
}
```

Allowed `final_status` values:

- `pass`
- `fail`
- `terminal_fail`

## Post-Run Requirements

After all nine sets are green:

1. Generate a consolidated mini summary from all set folders under
   `verification-<date>-<model>-by-set/`.
2. Run fixture cleanup (`fixtures cleanup --out fixtures/latest.json`).
3. Start canonical confirmation on `openai/gpt-5.3-codex` for `verify_pr` and
   `verify_release` in paired mode.

Canonical confirmation commands:

```bash
BENCH_PROVIDER_ID=openai BENCH_MODEL_ID=gpt-5.3-codex pnpm --filter @ghx-dev/benchmark run benchmark:verify:pr
BENCH_PROVIDER_ID=openai BENCH_MODEL_ID=gpt-5.3-codex pnpm --filter @ghx-dev/benchmark run benchmark:verify:release
```

## Acceptance Criteria

- Single-set verification runs end-to-end via one command and produces per-set artifacts.
- Multi-set driver runs all required sets in order.
- Prerequisite gate for `report --summary-json/--summary-md` passes before wrapper implementation.
- Invalid rows always block with non-zero exit and clear diagnostics.
- Read-only sets skip seed flow; other sets use seed-enabled flow.
- Preflight runs once and is not repeated per set.
- Failed sets produce scenario-level retry inputs, apply a max of two retries, and terminate
  cleanly on unrecovered failures.
- Per-set tracking artifacts are present for all nine sets and always written (including failures).
- Post-run summary + cleanup + canonical confirmation handoff are defined and executable.
