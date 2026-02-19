# Composite Capabilities Design

**Date:** 2026-02-19
**Branch:** `feat/composite-capabilities`
**Status:** Implemented

## Problem

Agent workflows frequently require multiple sequential ghx tool calls for what is logically a single operation. Benchmark data from `pr-fix-review-comments-wf-001` shows 18+ tool calls per workflow, where thread reply+resolve accounts for ~60% of calls. Each tool call costs ~4,800ms latency and ~1,190 tokens.

**Two layers of waste:**

1. **Agent → ghx round-trips:** Agent calls ghx N times for N atomic operations
2. **ghx → GitHub API calls:** Each ghx call makes a separate HTTP request to GitHub

## Goals

- Reduce agent tool calls by offering composite capabilities that combine related operations
- Reduce GitHub API calls by batching GraphQL operations using aliases
- Additive — coexist alongside atomic capabilities, no breaking changes
- Instruct agents to prefer composites via SKILL.md

## Design

### 1. Composite Card Schema

Extend `OperationCard` with an optional `composite` block:

```typescript
export interface CompositeStep {
  capability_id: string
  foreach?: string                     // JSONPath into input array
  params_map: Record<string, string>   // maps composite input → step params
}

export interface CompositeConfig {
  steps: CompositeStep[]
  output_strategy: "merge" | "array" | "last"
}

// Added to OperationCard:
composite?: CompositeConfig
```

Composites are **GraphQL-only** — no CLI fallback. If GraphQL preflight fails, the composite returns an error instructing the agent to use atomic capabilities instead. The agent can always fall back to calling atomic caps individually (which have their own CLI routes).

### 2. Operation Builder Pattern

Existing client methods (e.g., `runReplyToReviewThread`) bundle validation + variable assembly + execution + response mapping into one function. Composites need to reuse the build and map phases while batching execution.

Refactor participating methods into three composable phases:

```typescript
type OperationBuilder<TInput, TOutput> = {
  /** Validates input and assembles { mutation, variables } without executing.
   *  May be async for multi-step operations (e.g., issue.labels.update
   *  which does a lookup query before building the mutation). */
  build: (input: TInput) => MaybePromise<{ mutation: string; variables: GraphqlVariables }>
  /** Maps raw GQL response back to typed output */
  mapResponse: (raw: unknown) => TOutput
}
```

**Atomic calls** continue working unchanged — they call `build()`, execute, then `mapResponse()` inline.

**Composite calls** collect `build()` results from each step, batch them into a single request, then call each step's `mapResponse()` on the corresponding aliased response.

Builders are registered by capability ID so the composite engine can look them up:

```typescript
const OPERATION_BUILDERS: Record<string, OperationBuilder<unknown, unknown>> = {
  "pr.thread.reply": replyToReviewThreadBuilder,
  "pr.thread.resolve": resolveReviewThreadBuilder,
  "pr.thread.unresolve": unresolveReviewThreadBuilder,
  "issue.labels.update": issueLabelsUpdateBuilder,
  "issue.comments.create": issueCommentCreateBuilder,
  // ...
}
```

**Note:** Multi-step operations (e.g., `issue.labels.update` which does a lookup query before the mutation) need their lookup resolved before `build()` returns. The `build()` function may be async for these cases.

### 3. GraphQL Alias Batching Engine

New module: `packages/core/src/gql/batch.ts`

Takes multiple built operations and combines them into a single aliased request:

```typescript
interface BatchOperation {
  alias: string           // e.g. "reply0", "resolve0"
  mutation: string        // from builder.build()
  variables: GraphqlVariables
}

function buildBatchMutation(operations: BatchOperation[]): {
  document: string
  variables: GraphqlVariables  // merged with prefixed variable names
}
```

**Produced output** (example — 2 threads, reply+resolve each):

```graphql
mutation BatchComposite(
  $reply0_threadId: ID!, $reply0_body: String!,
  $resolve0_threadId: ID!,
  $reply1_threadId: ID!, $reply1_body: String!,
  $resolve1_threadId: ID!
) {
  reply0: addPullRequestReviewThreadReply(
    input: { pullRequestReviewThreadId: $reply0_threadId, body: $reply0_body }
  ) { comment { id } }
  resolve0: resolveReviewThread(
    input: { threadId: $resolve0_threadId }
  ) { thread { id isResolved } }
  reply1: addPullRequestReviewThreadReply(
    input: { pullRequestReviewThreadId: $reply1_threadId, body: $reply1_body }
  ) { comment { id } }
  resolve1: resolveReviewThread(
    input: { threadId: $resolve1_threadId }
  ) { thread { id isResolved } }
}
```

**Implementation details:**

- Parses mutation strings to extract variable declarations and selection sets
- Prefixes each selection with an alias
- Prefixes all variable names to avoid collisions
- Rewrites variable references in selection sets
- Sends as a single HTTP request via `GraphqlTransport.execute()`
- Partial failure: GitHub GraphQL returns errors per-alias; results are mapped back to step + iteration index

### 4. Composite Execution Path

In `engine.ts` — detect composite cards and dispatch differently:

```text
executeTask(task, input)
  → loadCard(task)
  → if card.composite:
      → expandCompositeSteps(card, input)
      → for each expanded step:
          → lookup OperationBuilder by capability_id
          → call builder.build(stepInput) → { mutation, variables }
          → store builder.mapResponse for later
      → buildBatchMutation(allOperations)
      → single GraphQL request
      → for each aliased result:
          → call stored mapResponse(aliasedResult)
      → aggregate results per output_strategy
  → else:
      → existing single-operation flow
```

**Action-aware expansion:** The `expandCompositeSteps()` function handles per-item action routing for composites like `pr.threads.composite`. When a `foreach` step iterates over an array where each item has an `action` field, the expansion selects which builder(s) to call per item based on the action value — e.g., `reply_and_resolve` emits two builder calls (reply + resolve) for that item. The YAML composite config declares the _available_ steps and their param mappings; the expansion logic determines which steps apply to each item. This keeps the YAML simple while supporting mixed-action arrays.

### 5. Composite Capabilities

#### `pr.threads.composite`

Reply to, resolve, unresolve, or reply+resolve multiple PR review threads in one call.

**Input:**

```yaml
input_schema:
  type: object
  required: [threads]
  properties:
    threads:
      type: array
      items:
        type: object
        required: [threadId, action]
        properties:
          threadId: { type: string }
          action:
            type: string
            enum: [reply, resolve, reply_and_resolve, unresolve]
          body: { type: string }  # required when action includes reply
```

Per-thread action determines which GQL operations are emitted:

- `reply` → 1 aliased mutation (addPullRequestReviewThreadReply)
- `resolve` → 1 aliased mutation (resolveReviewThread)
- `reply_and_resolve` → 2 aliased mutations (reply first, then resolve)
- `unresolve` → 1 aliased mutation (unresolveReviewThread)

**Composite config:**

```yaml
composite:
  steps:
    # Available builders — expansion selects per thread based on action field
    - capability_id: pr.thread.reply
      foreach: "threads"
      params_map: { threadId: "threadId", body: "body" }
    - capability_id: pr.thread.resolve
      foreach: "threads"
      params_map: { threadId: "threadId" }
    - capability_id: pr.thread.unresolve
      foreach: "threads"
      params_map: { threadId: "threadId" }
  output_strategy: array
```

The `action` field on each thread item controls which step(s) execute for that item — see section 4 (Action-aware expansion).

**Call reduction:** 2N → 1 (for N threads with reply+resolve)

#### `pr.review.submit` (Enhanced — Not a Composite)

Existing card enhanced with a GraphQL route using `addPullRequestReview` and a new `comments` field for inline review comments.

**Changes to existing card:**

```yaml
input_schema:
  # ... existing fields (owner, name, prNumber, event, body) ...
  comments:
    type: array
    items:
      type: object
      required: [path, body, line]
      properties:
        path: { type: string }
        body: { type: string }
        line: { type: integer }
        side: { type: string, enum: [LEFT, RIGHT] }
routing:
  preferred: graphql    # changed from cli
  fallbacks: [cli]      # cli fallback (without comments support)
```

**New GQL operation:** Uses `addPullRequestReview` mutation with `threads` argument.

**Call reduction:** N+1 → 1 (N comment creations + 1 review submit)

#### `issue.triage.composite`

Set labels and add a comment in one call.

**Input:**

```yaml
input_schema:
  type: object
  required: [owner, name, issueNumber]
  properties:
    owner: { type: string }
    name: { type: string }
    issueNumber: { type: integer }
    labelIds: { type: array, items: { type: string } }
    body: { type: string }
```

**Composite config:**

```yaml
composite:
  steps:
    - capability_id: issue.labels.update
      params_map: { issueId: "issueId", labelIds: "labelIds" }
    - capability_id: issue.comments.create
      params_map: { issueId: "issueId", body: "body" }
  output_strategy: merge
```

**Call reduction:** 2 → 1

#### `issue.update.composite`

Update issue fields + labels + assignees + milestone in one call.

**Input:**

```yaml
input_schema:
  type: object
  required: [owner, name, issueNumber]
  properties:
    owner: { type: string }
    name: { type: string }
    issueNumber: { type: integer }
    title: { type: string }
    body: { type: string }
    labelIds: { type: array, items: { type: string } }
    assigneeIds: { type: array, items: { type: string } }
    milestoneId: { type: string }
```

**Composite config:**

```yaml
composite:
  steps:
    - capability_id: issue.update
      params_map: { issueId: "issueId", title: "title", body: "body" }
    - capability_id: issue.labels.update
      params_map: { issueId: "issueId", labelIds: "labelIds" }
    - capability_id: issue.assignees.update
      params_map: { issueId: "issueId", assigneeIds: "assigneeIds" }
    - capability_id: issue.milestone.set
      params_map: { issueId: "issueId", milestoneId: "milestoneId" }
  output_strategy: merge
```

**Call reduction:** up to 4 → 1

### 6. Capability Listing Order

Composite capabilities appear first within each domain in `ghx capabilities list`:

```yaml
pr:
  pr.threads.composite
  pr.review.submit
  pr.view
  pr.list
  ...

issue:
  issue.triage.composite
  issue.update.composite
  issue.view
  issue.list
  ...
```

Cards with `.composite` suffix sort to the top of their domain group.

### 7. SKILL.md Update

Add generic instruction to prefer composites (no enumeration of individual caps):

```markdown
## Composite Capabilities

When a workflow involves multiple operations on the same resource,
prefer composite capabilities (suffixed with `.composite`) over
sequential atomic calls. Check `ghx capabilities list` for available
composites — their descriptions explain what they combine.
```

### 8. Projected Impact

**Benchmark: `pr-fix-review-comments-wf-001`**

| Metric | Before | After (projected) |
|---|---|---|
| Tool calls | 18 | ~10 |
| Latency | 86,011ms | ~50,000ms |
| Tokens | 21,430 | ~13,000 |
| GitHub API calls | 18 | ~6 |

### 9. Testing Strategy

- **Unit tests** for `buildBatchMutation()` — alias/variable prefixing, document construction
- **Unit tests** for `expandCompositeSteps()` — foreach expansion, params mapping, mixed actions
- **Unit tests** for composite execution path — mock GQL transport, verify single request
- **Unit tests** for partial failure handling — some aliases succeed, some fail
- **Integration tests** — composite cards against GitHub API
- **Benchmark comparison** — re-run scenarios with composite caps

Coverage target: 95% on new code.

### 10. Dropped Ideas

- **`pr.review.submit_with_context`** — diff is a prerequisite read; agent must reason about diffs before submitting. Can't batch across the reasoning step.
- **`workflow.run.diagnose`** — `run.view` output (job IDs) is needed before `job.logs.get`. Sequential data dependency.
- **CLI fallback for composites** — composites exist for GraphQL batching. If GraphQL isn't available, agents can call atomic capabilities individually (which have their own CLI routes). Adding `sequential`/`parallel_cli` batching strategies adds complexity for no value.
- **Transport-level batching (Approach C)** — doesn't reduce agent tool calls, only API calls. Less value.
- **Workflow capabilities (Approach B)** — too opinionated, embeds business logic, harder to test.

## References

- [GitHub GraphQL Mutations](https://docs.github.com/en/graphql/reference/mutations) — `addPullRequestReview` with `threads` argument
- [GitHub GraphQL Input Objects](https://docs.github.com/en/graphql/reference/input-objects) — `AddPullRequestReviewInput`, `DraftPullRequestReviewThread`
