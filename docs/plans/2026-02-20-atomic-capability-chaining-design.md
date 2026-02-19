# Atomic Capability Chaining Design

**Date:** 2026-02-20
**Branch:** `feat/atomic-chaining`
**Status:** Approved

## Problem

The current execution model supports one capability per tool call. Agents that need to perform multiple related GitHub mutations (e.g., resolve a PR thread and post a comment) must make separate tool calls, each incurring a round-trip. Composite capability cards (`pr.threads.composite`, `issue.triage.composite`, `issue.update.composite`) were introduced as a workaround but require pre-authoring a YAML card for every fixed combination — a maintenance burden that doesn't scale.

## Goal

Allow callers to specify an arbitrary list of `[capabilityId, input]` pairs in a single tool call. Steps execute concurrently (via `Promise.all`) using the existing GraphQL handler registry, reducing agent round-trips without requiring single-document batching.

## Decisions

| Question | Decision |
|---|---|
| Dynamic or card-based? | Dynamic runtime API — no card needed |
| Input data flow | All inputs specified upfront; no inter-step data flow |
| Error model | Partial results — per-step ok/error; chain continues regardless |
| Routes supported | GraphQL only — CLI doesn't support chaining |
| Composite cards | Deleted — never published (0.1.2 is last release) |
| API surface | `executeTasks` (primary) + `executeTask` as 1-item wrapper |
| Execution model | Concurrent `Promise.all` via existing `getGraphqlHandler` — no single-document batching |
| CLI interface | `ghx chain --steps '<json>' \| --steps -` |

## API Contract

### New types

```ts
type ChainStatus = "success" | "partial" | "failed"

interface ChainStepResult {
  task: string
  ok: boolean
  data?: unknown
  error?: ResultError
}

interface ChainResultEnvelope {
  status: ChainStatus   // success = all ok, partial = some ok, failed = none ok
  results: ChainStepResult[]
  meta: {
    route_used: "graphql"
    total: number
    succeeded: number
    failed: number
  }
}
```

### `executeTasks` — new primary function

```ts
executeTasks(
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  deps: ExecutionDeps,
): Promise<ChainResultEnvelope>
```

- **1 item:** full routing engine with CLI fallback (identical to current `executeTask` behaviour)
- **2+ items:** GraphQL-only; pre-flight rejects if any step has no `card.graphql`

### `executeTask` — thin wrapper (unchanged signature)

```ts
async function executeTask(
  request: TaskRequest,
  deps: ExecutionDeps,
): Promise<ResultEnvelope> {
  const chain = await executeTasks([request], deps)
  const step = chain.results[0]
  return {
    ok: step.ok,
    data: step.data,
    error: step.error,
    meta: { capability_id: step.task, route_used: "graphql", ... },
  }
}
```

No existing callsites change.

### New public exports

```ts
export { executeTasks } from "./core/routing/engine.js"
export type { ChainResultEnvelope, ChainStepResult, ChainStatus } from "./core/contracts/envelope.js"
```

### CLI interface

```
ghx chain --steps '<json-array>'
ghx chain --steps -           # read from stdin
```

`--steps` accepts a JSON array of `{ task, input }` objects — identical structure to `executeTasks` requests. Mirrors `ghx run --input` ergonomics. Output is the `ChainResultEnvelope` serialised as JSON.

## Execution Engine

### Step 1 — Card resolution & input validation

For each `{ task, input }`:
1. `getOperationCard(task)` — reject whole chain if not found
2. Validate `input` against `card.input_schema` (AJV)
3. Assert `card.graphql` exists — all chainable caps must have a GQL route

Pre-flight failures (missing card, schema error, no graphql config) reject the **whole chain** before any HTTP call — no partial execution for caller errors.

### Step 2 — Concurrent dispatch via handler registry

Each step dispatches through the existing `getGraphqlHandler` registry (in `gql/capability-registry.ts`), which maps capability ID → typed `GraphqlHandler` function:

```ts
const stepPromises = requests.map(async ({ task, input }, i) => {
  const handler = getGraphqlHandler(task)
  try {
    const data = await handler(input, deps.githubClient)
    return { task, ok: true, data } satisfies ChainStepResult
  } catch (err) {
    return { task, ok: false, error: mapError(err) } satisfies ChainStepResult
  }
})

const results = await Promise.all(stepPromises)
```

This approach:
- Naturally handles capabilities that do multi-step internal HTTP calls (label lookup → update, repo ID lookup → create, etc.)
- Requires no single-document GQL batching or variable mapping from cards
- Executes all steps concurrently, independent of whether individual steps are queries or mutations
- Reuses the same execution path as `runGraphqlCapability`

### Step 3 — Result assembly

```ts
const succeeded = results.filter(r => r.ok).length
const status: ChainStatus =
  succeeded === results.length ? "success" :
  succeeded === 0              ? "failed"  : "partial"

return {
  status,
  results,
  meta: { route_used: "graphql", total: results.length, succeeded, failed: results.length - succeeded },
}
```

## Migration

### Deletions

| What | Location |
|---|---|
| `OPERATION_BUILDERS` registry + all builder functions | `gql/builders.ts` → delete file |
| `expandCompositeSteps` | `core/execute/composite.ts` → delete file |
| `executeComposite` | `core/routing/engine.ts` |
| `CompositeConfig`, `CompositeStep` types | `core/registry/types.ts` |
| `composite?` field on `OperationCard` | `core/registry/types.ts` |
| `composite` property in card JSON schema | `core/registry/operation-card-schema.ts` |
| Composite IDs from `preferredOrder` | `core/registry/index.ts` |
| `pr.threads.composite.yaml` | `core/registry/cards/` |
| `issue.triage.composite.yaml` | `core/registry/cards/` |
| `issue.update.composite.yaml` | `core/registry/cards/` |

### Additions

| What | Location |
|---|---|
| `executeTasks` | `core/routing/engine.ts` |
| `ChainResultEnvelope`, `ChainStepResult`, `ChainStatus` | `core/contracts/envelope.ts` |
| `ghx chain` subcommand | `cli/commands/chain.ts` |
| Dispatch in CLI entry | `cli/index.ts` |
| New exports | `index.ts` |

### Changeset

Delete `composite-capabilities-gql-integration.md`. Create new `minor` changeset — `executeTasks` is additive; composite removal is not breaking since composites were never published (current released version: `0.1.2`).

## Validation

### Runtime (this PR)

`executeTasks` checks `card.graphql` exists for each step before issuing any HTTP call. If a step has no graphql config, the entire chain is rejected pre-flight with a per-step error:

```
"capability 'pr.checks.rerun_failed' has no GraphQL route and cannot be chained"
```

Single-step `executeTask` is unaffected — CLI-routed caps continue to work via the full routing engine.

### Schema enforcement (follow-up PR)

39 of ~60 current cards lack a `graphql` config. Adding graphql support to all caps and making `graphql` required in `operation-card-schema.ts` is scoped to a follow-up PR. At that point, every cap becomes chainable and the runtime pre-flight becomes a pure safety net.
