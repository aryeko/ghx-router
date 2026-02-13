# ghx-router

CLI-first GitHub execution router for agents.

## Goals

- Make GitHub task execution context-efficient for agents.
- Provide one stable interface (`ghx`) that agents can call without re-learning docs each run.
- Prefer `gh` CLI for covered workflows and reliability.
- Use REST or GraphQL only when CLI is missing capability or is materially less efficient.
- Return deterministic JSON with clear error semantics for automation.
- Support Claude/OpenCode and non-Claude agent runtimes equally well.

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

## Initial Direction

1. Build a universal `ghx` CLI with stable JSON contracts.
2. Implement a routing policy engine (`gh` vs REST vs GraphQL).
3. Add typed GraphQL client generation from schema.
4. Add skill/docs for agent guidance that call `ghx` first.

## Design Docs

- Architecture: `docs/plans/2026-02-13-ghx-router-architecture.md`
- Efficiency evaluation plan: `docs/plans/2026-02-13-efficiency-evaluation.md`
