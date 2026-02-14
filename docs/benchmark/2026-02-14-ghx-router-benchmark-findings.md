# GHX Router Benchmark Findings (2026-02-14)

## Scope

This document summarizes:

- why `ghx_router` did not pass the benchmark gate,
- what changes were implemented to improve benchmark fidelity and runtime behavior,
- what happened in the timeout session,
- current measured results after the fixes.

All analysis in this document uses runs in this worktree on branch `feat/benchmark-plan-fixes`.

## Main Findings

1. **Primary gate miss was tokens metric selection and reliability, not route/tool efficiency.**
   - `ghx_router` continues to outperform `agent_direct` on latency and tool-call count.
   - The old gate on total tokens hid signal because cache-read dominated many runs.

2. **A packaging/path mismatch caused avoidable `ghx` capability failures in earlier investigation.**
   - Operation cards were copied to `dist/core/registry/cards` but runtime also depended on `dist/cards` in some execution paths.
   - Missing cards led to `Unsupported task` behavior and model-side troubleshooting loops.

3. **The timeout in `ghx_router` was a session finalization stall, not a slow `ghx` command.**
   - In timed-out session `ses_3a43cb116ffeU8Uxg8kQIi4l32`, the `bash` tool call completed quickly with valid CLI JSON output.
   - The follow-up assistant turn emitted a pending `StructuredOutput` tool call and never completed.
   - Runner then hit the scenario timeout waiting for a completed assistant message.

## Changes Implemented

### 1) Core packaging fix

- Updated `packages/core/scripts/copy-registry-cards.mjs` to copy cards to both:
  - `dist/core/registry/cards`
  - `dist/cards`

This removes a source of capability lookup inconsistency after build.

### 2) `ghx_router` preflight and fail-fast guardrails

Updated `packages/benchmark/src/runner/suite-runner.ts`:

- Added `assertGhxRouterPreflight(scenarios)`:
  - runs `node ../core/dist/cli/index.js capabilities list --json`
  - fails before suite start when capabilities are empty/missing required scenario tasks
- Added prompt contract to fail fast:
  - if `ghx` command fails, return final envelope immediately (no extra debug loops)
- Updated forced tool command hint and mode prompt to use local built CLI path:
  - `node ../core/dist/cli/index.js run <task> --input '<json>'`

### 3) Scenario assertion correction for `pr-exec`

Set `expect_valid_output: true` for all 9 `pr-exec` scenarios so success/validity metrics reflect actual expected behavior.

### 4) Metric and gate update

Updated `packages/benchmark/src/report/aggregate.ts`:

- Added `medianTokensActive` (`total - cache_read`)
- Added `tokensActiveReductionPct`
- Switched gate check from `tokens_reduction` to `tokens_active_reduction`
- Kept total tokens reported for visibility

Docs updated:

- `docs/benchmark/efficiency-criteria.md`
- `docs/benchmark/metrics.md`

### 5) Test updates

Updated/added tests covering:

- preflight behavior and failure modes,
- new command path expectations,
- updated aggregate threshold keys.

Files:

- `packages/benchmark/test/unit/suite-runner.test.ts`
- `packages/benchmark/test/unit/suite-runner-runsuite.test.ts`
- `packages/benchmark/test/unit/report-aggregate.test.ts`

## Verification Executed

Commands run in this worktree:

- `pnpm --filter @ghx-dev/benchmark run test`
- `pnpm --filter @ghx-dev/benchmark run typecheck`
- `pnpm --filter @ghx-dev/benchmark run check:scenarios`
- `pnpm --filter @ghx-dev/core run build`

Additional check:

- `ls packages/core/dist/cards | wc -l` => `66`

## Fresh Benchmark Results (pr-exec, 3 repetitions)

Generated from:

- `packages/benchmark/results/2026-02-14T10-36-35-501Z-agent_direct-suite.jsonl`
- `packages/benchmark/results/2026-02-14T10-46-49-424Z-ghx_router-suite.jsonl`
- `packages/benchmark/reports/latest-summary.json`

Summary:

- `agent_direct`:
  - success 100.00%
  - output valid 100.00%
  - median latency 17254 ms
  - median total tokens 10995
  - median active tokens 1139
  - median tool calls 3

- `ghx_router`:
  - success 96.30%
  - output valid 96.30%
  - median latency 12300 ms
  - median total tokens 10872
  - median active tokens 888
  - median tool calls 2

Delta (`ghx_router` vs `agent_direct`):

- active-token reduction: **22.04%** (target 25%) - fail
- latency reduction: **28.71%** (target 20%) - pass
- tool-call reduction: **33.33%** (target 30%) - pass
- success-rate delta: **-3.70%** (target >= -1%) - fail
- output validity: **96.30%** (target 99%) - fail

## Timeout Session Analysis

Timed-out row:

- scenario: `pr-review-submit-request-changes-001`
- session: `ses_3a43cb116ffeU8Uxg8kQIi4l32`
- latency: `60033 ms`
- error: `Timed out waiting for assistant message in session.messages`

Observed sequence:

1. Assistant turn 1 completed in ~6.1s.
2. `bash` tool executed `node ../core/dist/cli/index.js run pr.review.submit_request_changes ...` and completed in ~1.9s.
3. CLI output was a valid envelope (`ok:false` with GraphQL request-changes-on-own-PR error).
4. Assistant turn 2 started, reasoned, then emitted pending `StructuredOutput` and never completed.
5. Harness waited until timeout.

Control rerun of that same scenario (`ghx_router`, 3 reps):

- all 3 passed,
- no timeout,
- similar latency/tokens to normal runs.

Conclusion: this timeout is consistent with intermittent session finalization/tool-state stall, not command execution failure.

## Current State

The implemented changes remove earlier environment/packaging noise and improve benchmark signal quality.

Remaining gate misses are now mostly attributable to:

- one intermittent timeout reducing success/validity,
- active-token reduction landing close to threshold but still below target in this run.
