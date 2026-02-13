# ghx-router

CLI-first GitHub execution router for agents.

## Status

- Current phase: Phase 3 is complete and Phase 4 execution is starting.
- Not yet production-ready.
- Primary objective now: execute Phase 4 normalization + telemetry and keep benchmark validation green.

## Goals

- Make GitHub task execution context-efficient for agents.
- Provide one stable interface (`ghx`) that agents can call without re-learning docs each run.
- Prefer `gh` CLI for covered workflows and reliability.
- Use REST or GraphQL only when CLI is missing capability or is materially less efficient.
- Return deterministic JSON with clear error semantics for automation.
- Support Claude/OpenCode and non-Claude agent runtimes equally well.

## Why ghx-router

- Agents lose time and context re-deciding API paths (`gh` vs REST vs GraphQL) per task.
- Prompt-level routing decisions are inconsistent across runs.
- A single runtime policy can reduce latency, retries, and token usage while improving output consistency.

## Motivation

Today, agents can interact with GitHub through `gh` CLI, `gh api`, and MCP servers. The problem is not capability; it is execution efficiency and consistency.

Common failure pattern:

1. Agent starts a task.
2. It fetches docs or schema context again.
3. It chooses an interface ad hoc (`gh`, REST, or GraphQL).
4. It spends extra tokens/time resolving output shape, pagination, and auth edge cases.

This "interface ping-pong" makes runs slower, more expensive, and less reliable.

`ghx-router` encodes the decision logic once so agents do not re-derive it each time:

- CLI-first routing policy
- Typed API access when API is the better path
- Built-in defaults for pagination, retries, and auth checks
- Stable machine output contracts

### Keep-us-honest note on MCP cost

MCP is not universally "bad" or "too expensive." It can be a great integration surface in some runtimes. But in many agent workflows, repeated tool-schema exchange and orchestration overhead can increase token and latency cost relative to direct CLI calls for common operations. This project optimizes for a CLI-first baseline and uses API paths only when they provide clear value.

## Planned Interface (v1)

Primary command surface:

```bash
ghx run <task-id> --input '<json>'
```

Planned normalized output envelope:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "source": "cli",
    "reason": "coverage_gap"
  }
}
```

## Routing Decision Matrix (v1)

Use this policy to choose execution path per task.

| Task Type | Preferred Path | Why |
|---|---|---|
| Standard repo/PR/issue operations (`list`, `view`, `create`, `edit`, `status`) | `gh` CLI | Fast, stable UX, built-in auth, predictable behavior |
| Common automation with structured output | `gh` CLI + `--json` | Keeps CLI reliability while giving machine-readable output |
| Endpoint not covered by `gh` command surface | REST via `gh api` | Minimal switch cost, keeps auth/session from CLI |
| Deep graph traversal (nested relations, selective fields across objects) | GraphQL (typed client) | Fewer round-trips, precise field selection, strong typing |
| Large paginated reads with known REST endpoint support | REST via `gh api --paginate` | Simple and robust for flat resource enumeration |
| Complex cross-entity aggregation where REST causes N+1 calls | GraphQL (typed client) | Better query efficiency and fewer request chains |
| Write operations with mature CLI support | `gh` CLI first | Lower risk and clearer ergonomics for mutation workflows |
| Write operations not exposed in CLI but available in API | REST first, GraphQL if required | Prefer simplest viable API path |

### Tie-Break Rules

When multiple paths are possible, choose in this order:

1. `gh` CLI command with `--json` support
2. `gh api` REST endpoint
3. Typed GraphQL client

Only bypass this order when there is a clear and documented reason (coverage gap, major performance gain, or output-shape requirement).

### Required Runtime Guarantees

All paths must produce a normalized envelope:

- `success`: boolean
- `data`: object or array on success
- `error`: structured error object on failure
- `meta`: pagination, rate-limit, and source path (`cli` | `rest` | `graphql`)

This keeps agent behavior stable regardless of the underlying execution route.

## Non-Goals

- Replacing the entire `gh` CLI
- Building a generic automation framework unrelated to GitHub workflows
- Forcing GraphQL usage where CLI or REST is simpler

## Quickstart

Prerequisites:

- Node.js 20+
- GitHub CLI (`gh`) authenticated

Current repo includes active implementation plus design docs. You can review:

- architecture and phased plans under `docs/`
- benchmark harness package under `packages/benchmark/`

Note: `repo.view`, `issue.view`, and `pr.view` execution paths are wired through the GraphQL engine route.

## Initial Direction

1. Build a universal `ghx` CLI with stable JSON contracts.
2. Implement a routing policy engine (`gh` vs REST vs GraphQL).
3. Add typed GraphQL client generation from schema.
4. Add skill/docs for agent guidance that call `ghx` first.

## Roadmap Snapshot

1. Phase 1: core CLI skeleton and task contracts.
2. Phase 2: deterministic routing policy engine.
3. Phase 2.5: thin benchmark slice (5-8 scenarios, early signal).
4. Phase 3: adapters + safety + integration tests (complete).
5. Phase 4-5: normalization, telemetry, and v1 task coverage.
6. Phase 6: full benchmark validation gate.

## Benchmarking

- Thin-slice harness: `packages/benchmark/README.md`
- Efficiency plan: `docs/plans/2026-02-13-efficiency-evaluation.md`
- Benchmark design (TS SDK): `docs/plans/2026-02-13-benchmark-harness-ts-sdk-design.md`

Current benchmark state:

- Scenarios live in `packages/benchmark/scenarios/`.
- Runner lives in `packages/benchmark/src/`.
- Aggregation/reporting templates are defined.
- SDK-backed benchmark execution is wired; current focus is reliability and reporting stabilization.

## Design Docs

- Plans index (what is active): `docs/plans/README.md`
- Architecture: `docs/plans/2026-02-13-ghx-router-architecture.md`
- Efficiency evaluation plan: `docs/plans/2026-02-13-efficiency-evaluation.md`
- Phased implementation plan: `docs/plans/2026-02-13-ghx-router-phased-plan.md`
- Benchmark harness design: `docs/plans/2026-02-13-benchmark-harness-ts-sdk-design.md`

## Architecture Docs

- Repository structure: `docs/architecture/repository-structure.md`

## Contributing

- Open an issue before large architecture or benchmark methodology changes.
- Keep routing policy changes aligned with `docs/architecture/routing-policy.md`.
- Keep benchmark metric changes aligned with `docs/benchmark/metrics.md`.
