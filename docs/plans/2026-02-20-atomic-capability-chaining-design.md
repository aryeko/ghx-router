# Atomic Capability Chaining Design

**Date:** 2026-02-20
**Branch:** `feat/atomic-chaining`
**Status:** Approved

## Problem

The current execution model supports one capability per tool call. Agents that need to perform multiple related GitHub mutations (e.g., resolve a PR thread and post a comment) must make separate tool calls, each incurring a round-trip. Composite capability cards (`pr.threads.composite`, `issue.triage.composite`, `issue.update.composite`) were introduced as a workaround but require pre-authoring a YAML card for every fixed combination — a maintenance burden that doesn't scale.

## Goal

Allow callers to specify an arbitrary list of `[capabilityId, input]` pairs in a single tool call, batched into as few GitHub API requests as possible (1 for pure query or pure mutation chains; 2 concurrent for mixed).

## Decisions

| Question | Decision |
|---|---|
| Dynamic or card-based? | Dynamic runtime API — no card needed |
| Input data flow | All inputs specified upfront; no inter-step data flow |
| Error model | Partial results — per-step ok/error; chain continues regardless |
| Routes supported | GraphQL only — CLI doesn't support batching |
| Composite cards | Deleted — never published (0.1.2 is last release) |
| API surface | `executeTasks` (primary) + `executeTask` as 1-item wrapper |

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
- **2+ items:** GraphQL-only batch; pre-flight rejects if any step has no `card.graphql`

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

## Batching Engine

### Step 1 — Card resolution & input validation

For each `{ task, input }`:
1. `getOperationCard(task)` — `ChainStepResult` error if not found
2. Validate `input` against `card.input_schema` (AJV)
3. Assert `card.graphql` exists — design invariant; all caps must have a GQL route

Pre-flight failures (missing card, schema error, no graphql config) reject the **whole chain** before any HTTP call — no partial execution for caller errors.

### Step 2 — Variable mapping from card

`card.graphql.variables` maps GQL variable names → input field names. No separate builder registry needed:

```ts
const gqlVars: GraphqlVariables = {}
for (const [gqlVar, inputField] of Object.entries(card.graphql.variables ?? {})) {
  gqlVars[gqlVar] = step.input[inputField]
}
```

Each step is assigned a deterministic alias: `${capId.replace(/\W/g, "_")}_${index}`.

### Step 3 — Operation type detection & grouping

Extend existing `parseMutation` → `parseOperation` to extract `type: "query" | "mutation"` from the leading keyword of the GQL document. Split steps into `querySteps[]` and `mutationSteps[]`.

### Step 4 — Batch document construction

- `mutationSteps` → `buildBatchMutation` (existing, unchanged)
- `querySteps` → `buildBatchQuery` (new, mirrors `buildBatchMutation`, emits `query BatchChain(...)`)

Both return `{ document: string, variables: GraphqlVariables }`.

### Step 5 — Execution

Per GraphQL spec:

| Chain composition | HTTP calls | GitHub execution |
|---|---|---|
| All mutations | 1 | Sequential (spec guarantee) |
| All queries | 1 | Parallel (spec guarantee) |
| Mixed | 2, concurrent via `Promise.all` | Minimum possible per spec |

HTTP-level array batching is not officially supported by GitHub's GraphQL API. The 2-call path for mixed chains is the minimum achievable within the spec.

Note: sequential mutation execution on GitHub's side is a GraphQL spec property, not a ghx design choice. Callers should be aware that mutation order within a chain is preserved and significant.

### Step 6 — Result assembly

Merge `queryResult` and `mutationResult` by alias key. For each step in original input order:
- Alias present in response → validate against `card.output_schema` → `ChainStepResult { ok: true, data }`
- Alias absent + present in `errors[]` → `ChainStepResult { ok: false, error }`

Derive `ChainStatus`:
```ts
const succeeded = results.filter(r => r.ok).length
const status: ChainStatus =
  succeeded === results.length ? "success" :
  succeeded === 0              ? "failed"  : "partial"
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
| `pr.threads.composite.yaml` | `core/registry/cards/` |
| `issue.triage.composite.yaml` | `core/registry/cards/` |
| `issue.update.composite.yaml` | `core/registry/cards/` |

### Additions

| What | Location |
|---|---|
| `executeTasks` | `core/routing/engine.ts` |
| `ChainResultEnvelope`, `ChainStepResult`, `ChainStatus` | `core/contracts/envelope.ts` |
| `buildBatchQuery` | `gql/batch.ts` |
| `parseOperation` | `gql/batch.ts` |
| New exports | `index.ts` |

### Changeset

Delete `composite-capabilities-gql-integration.md`. Create new `minor` changeset — `executeTasks` is additive; composite removal is not breaking since composites were never published (current released version: `0.1.2`).

## Design Invariant

Every operation card must have a `graphql` config. Cards without one cannot participate in chains and will be caught at runtime. This should be enforced at card authoring time (lint/schema check) going forward.
