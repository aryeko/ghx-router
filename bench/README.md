# Benchmark Harness (Thin Slice)

This directory contains the early benchmark slice used to validate `ghx-router` direction before full implementation scale.

## Structure

- `scenarios/` - scenario definitions (input + assertions)
- `scripts/` - harness runners and helpers
- `results/` - raw run logs (JSONL)
- `reports/` - aggregated summaries

## Scenario Format (v0)

Each scenario file is JSON with:

- `id`: unique scenario id
- `name`: short human-readable name
- `task`: canonical task id intended for `ghx run`
- `input`: task input payload
- `assertions`: required success conditions
- `tags`: optional grouping labels

## Thin-Slice Targets

- Start with 5-8 scenarios.
- Run each scenario in:
  - `agent_direct`
  - `mcp` (when available)
  - `ghx_router`
- Capture at least 10 runs per scenario per mode.

## Runner (Stub)

Current runner writes JSONL rows with the agreed schema:

```bash
<ts-runner> bench/scripts/run-thin-slice.ts ghx_router 1
```

Arguments:

- `mode`: `agent_direct` | `mcp` | `ghx_router`
- `runs per scenario`: integer, default `1`

The current script is a skeleton and records placeholder values until SDK-backed execution is connected.

## Output Logging Contract (v1 target)

Write one JSON object per line in `results/*.jsonl`:

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
  "error": null
}
```

Reference: `docs/plans/2026-02-13-benchmark-harness-ts-sdk-design.md`.
