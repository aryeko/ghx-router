# Benchmark Harness Design (TypeScript + OpenCode SDK)

Status: active sub-plan (Phase 2.5 benchmark implementation).

## Purpose

Define a reliable, repeatable benchmark harness that proves `ghx-router` improves efficiency versus current agent workflows.

This design uses the OpenCode TypeScript SDK as the measurement source of truth for session timing, token usage, and cost.

## Goals

- Measure latency, token usage, tool activity, and success across benchmark modes.
- Ensure runs are reproducible across time and environments.
- Produce machine-readable artifacts for CI and release reports.
- Keep measurement logic independent from `ghx-router` implementation logic.

## Non-Goals

- Full framework for arbitrary model evaluation.
- Perfectly simulating all human-agent interactions.
- Replacing product telemetry.

## Benchmark Modes

- `agent_direct`: prompt-driven baseline where agent chooses `gh`/REST/GraphQL directly.
- `mcp`: agent uses MCP tools where available.
- `ghx_router`: agent uses `ghx run <task> --input ...` as primary interface.

Each scenario runs in one or more modes with identical task intent.

## Core Architecture

1. Scenario Loader
- Reads `packages/benchmark/scenarios/*.json`.
- Validates schema for scenario input, assertions, and tags.

2. Run Orchestrator
- Selects scenario order (optionally randomized with fixed seed).
- Executes N repetitions per scenario per mode.
- Handles retries at harness level only for infrastructure failures.

3. OpenCode SDK Session Driver
- Creates session via SDK.
- Sends benchmark prompt through `session.chat(...)`.
- Collects response metadata from SDK types.

4. Metrics Collector
- Captures wall-clock timing and SDK-reported timing/tokens/cost.
- Extracts tool usage signals from message parts when available.
- Normalizes into benchmark result row.

5. Assertion Engine
- Validates scenario success criteria and output schema.
- Computes `output_valid` and failure reasons.

6. Artifact Writer
- Writes JSONL raw rows to `packages/benchmark/results/`.
- Writes aggregate summaries to `packages/benchmark/reports/`.

## OpenCode SDK Metrics Model

Primary values should come from `AssistantMessage` and message parts:

- `assistant.cost`
- `assistant.time.created`
- `assistant.time.completed`
- `assistant.tokens.input`
- `assistant.tokens.output`
- `assistant.tokens.reasoning`
- `assistant.tokens.cache.read`
- `assistant.tokens.cache.write`

When present, `step-finish` parts may provide per-step token/cost details.

Harness-derived values:

- `latency_ms_wall`: monotonic timer around request lifecycle.
- `sdk_latency_ms`: `time.completed - time.created` when available.
- `success`: scenario assertion outcome.

## Result Row Contract (v1)

Each execution appends one row in JSONL:

```json
{
  "timestamp": "2026-02-13T22:00:00.000Z",
  "run_id": "uuid",
  "mode": "ghx_router",
  "scenario_id": "pr-list-open-001",
  "iteration": 4,
  "session_id": "sess_xxx",
  "success": true,
  "output_valid": true,
  "latency_ms_wall": 842,
  "sdk_latency_ms": 801,
  "tokens": {
    "input": 1200,
    "output": 340,
    "reasoning": 110,
    "cache_read": 0,
    "cache_write": 0,
    "total": 1650
  },
  "cost": 0.0123,
  "tool_calls": 3,
  "api_calls": 2,
  "retry_count": 0,
  "model": {
    "provider_id": "openai",
    "model_id": "openai/gpt-5.3-codex"
  },
  "git": {
    "repo": "aryeko/ghx-router",
    "commit": "abc123"
  },
  "error": null
}
```

## Scenario Schema (v1)

Add/extend scenario fields for benchmark control:

- `id`, `name`, `task`, `input`, `assertions`, `tags`
- `prompt_template`: canonical prompt used for mode execution
- `timeout_ms`
- `allowed_retries`
- `fixture`: repository and branch/worktree setup instructions

## Reliability Controls

- Fixed repository fixtures for all runs.
- Fixed model/provider per benchmark suite.
- Randomized scenario order with logged seed.
- Minimum 10 repetitions per scenario/mode.
- Isolated workspace per run (clean branch/worktree).
- Stable network assumptions logged in metadata.

## Failure Taxonomy

Normalize failures into explicit categories:

- `infra_error` (SDK/network/service instability)
- `timeout`
- `assertion_failed`
- `schema_invalid`
- `auth_or_scope_error`
- `tool_execution_error`

This allows correct exclusion/inclusion in analysis.

## Reporting

Generate per-mode and comparison reports:

- median and P90 latency
- median and P90 token totals
- success rate and output validity rate
- tool/API call counts
- confidence intervals for deltas

Release gate should reuse thresholds from `docs/plans/2026-02-13-efficiency-evaluation.md`.

## Implementation Phases (Harness)

1. Phase A - SDK-integrated runner foundation
- session create/chat lifecycle
- raw row writing

2. Phase B - assertion engine + scenario schema upgrade
- success/output validity checks

3. Phase C - aggregation and report generation
- summary JSON + markdown report

4. Phase D - CI automation and reproducibility hardening
- seeded runs, fixture bootstrap, metadata capture

## Open Questions

- Should `tool_calls` be sourced from SDK message parts only, or supplemented by shell trace parsing?
- For MCP mode, do we run via same prompt strategy or mode-specific controlled prompt templates?
- Should release gating use strict thresholds on every run, or rolling window statistics?
