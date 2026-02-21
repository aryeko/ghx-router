# Implementation Plan: Atomic Chaining Follow-up — Items 3, 5, 6, 8

> Implements items 3 (partial error handling), 5 (expand chainable coverage),
> 6 (resolution cache), and 8 (pr.reviews.submit validation) from
> `docs/plans/2026-02-20-atomic-chaining-followup.md`.

---

## Execution Order

```
Item 8 (low risk, test-only)
  → Item 6 (new module, no breaking changes)
    → Item 3 (transport + engine changes)
      → Item 5 (new GQL files + card updates, depends on item 3 for partial error support)
```

Item 8 is isolated and validates existing code. Item 6 is a new module with no
breaking changes. Item 3 modifies existing interfaces. Item 5 builds on all three.

---

## Item 8 — `pr.reviews.submit` resolution inject-path validation

**Goal:** Confirm the `pullRequestId` scalar inject path
(`repository.pullRequest.id`) matches the actual `PrNodeId` query response shape.

### 8a. Add focused unit test

**File:** `packages/core/test/unit/pr-review-resolution.test.ts` (new)

Test cases:
1. **Happy path** — Mock `PrNodeId` response matching the generated type
   `PrNodeIdQuery`:
   ```ts
   const lookupResult = {
     repository: {
       pullRequest: { id: "PR_kwDOTest1234" },
     },
   }
   ```
   Call `applyInject({ target: "pullRequestId", source: "scalar",
   path: "repository.pullRequest.id" }, lookupResult, input)`.
   Assert returns `{ pullRequestId: "PR_kwDOTest1234" }`.

2. **Missing PR** — `lookupResult.repository.pullRequest` is `null`.
   Assert `applyInject` throws with message matching `/no value at path/.

3. **buildMutationVars integration** — Given the `PrReviewSubmit` mutation
   document string, call `buildMutationVars(doc, input, resolved)`. Assert
   output contains `pullRequestId`, `event`, `body` and omits `owner`, `name`,
   `prNumber` (which are lookup-only vars, not mutation vars).

### 8b. Add executeTasks integration test for pr.reviews.submit

**File:** `packages/core/test/unit/engine.test.ts` (append to existing
`executeTasks` describe block)

Test: "pr.reviews.submit chain resolves pullRequestId via PrNodeId lookup"
- Use `vi.resetModules()` + `vi.doMock` pattern (matching existing tests)
- Mock card with `graphql.resolution` matching the real card's config
- Mock `githubClient.query`:
  - Call 1 (Phase 1): returns `{ step0: { repository: { pullRequest: { id: "PR_1" } } } }`
  - Call 2 (Phase 2): returns `{ step0: { addPullRequestReview: { pullRequestReview: { id: "RV_1" } } } }`
- Assert `result.status === "success"` and `result.results[0].ok === true`
- Assert `buildBatchMutationMock` received variables containing `pullRequestId: "PR_1"`

---

## Item 6 — Resolution cache for cross-call lookups

**Goal:** Cache Phase 1 lookup results with a TTL to avoid redundant network
calls when an agent issues multiple chains against the same repo in succession.

### 6a. Create `resolution-cache.ts`

**File:** `packages/core/src/core/routing/resolution-cache.ts` (new)

```ts
export interface ResolutionCache {
  get(key: string): unknown | undefined
  set(key: string, value: unknown): void
  clear(): void
  readonly size: number
}

export interface ResolutionCacheOptions {
  ttlMs?: number     // default 60_000
  maxEntries?: number // default 200
}

export function createResolutionCache(opts?: ResolutionCacheOptions): ResolutionCache
```

Implementation:
- Backing store: `Map<string, { value: unknown; expiresAt: number }>`
- Key format: callers build keys via exported helper
  `buildCacheKey(operationName: string, variables: Record<string, unknown>): string`
  using `${operationName}:${JSON.stringify(variables, Object.keys(variables).sort())}`
  (sorted keys for stability)
- `get()` returns `undefined` for expired entries and lazily deletes them
- `set()` evicts oldest entry if `maxEntries` exceeded (simple FIFO via
  insertion order of `Map`)
- No `WeakMap` — keys are strings

### 6b. Wire into `ExecutionDeps`

**File:** `packages/core/src/core/routing/engine.ts`

Changes:
1. Add optional `resolutionCache?: ResolutionCache` to `ExecutionDeps`
2. In `executeTasks()` Phase 1, before building the batch query:
   - For each `lookupInput`, check `deps.resolutionCache?.get(cacheKey)`
   - If hit: populate `lookupResults[stepIndex]` directly, remove from
     `lookupInputs` array (skip network call for that step)
3. After Phase 1 batch query succeeds:
   - For each lookup result, call `deps.resolutionCache?.set(cacheKey, result)`
4. If all lookups are cache hits, skip the Phase 1 HTTP call entirely

### 6c. Wire into chain.ts CLI

**File:** `packages/core/src/cli/commands/chain.ts`

- Import and create a `ResolutionCache` instance (one per CLI invocation)
- Pass into `executeTasks(..., { ..., resolutionCache })`
- For single CLI invocations this has no effect (single call), but the
  library API (`executeTasks` called programmatically) benefits from callers
  providing a shared cache across multiple calls

### 6d. Export from public API

**File:** `packages/core/src/index.ts`

- Export `createResolutionCache`, `buildCacheKey`, and `ResolutionCache` type

### 6e. Tests

**File:** `packages/core/test/unit/resolution-cache.test.ts` (new)

Test cases:
1. `get` returns `undefined` for missing key
2. `set` + `get` round-trip returns cached value
3. Expired entries return `undefined` after TTL
4. `maxEntries` evicts oldest entry when exceeded
5. `clear()` empties the cache
6. `buildCacheKey` produces stable keys regardless of property order

**File:** `packages/core/test/unit/engine.test.ts` (append)

Test: "executeTasks uses resolutionCache to skip Phase 1 for cached lookups"
- Provide a pre-populated `resolutionCache` in deps
- Assert `githubClient.query` is called only once (Phase 2 mutation), not twice

---

## Item 3 — Partial error handling in Phase 2

**Goal:** When a batch mutation returns partial data + errors, mark only the
failed steps as `ok: false` instead of failing the entire batch. Produce
`status: "partial"` when appropriate.

### 3a. Add `executeRaw` to `GraphqlTransport`

**File:** `packages/core/src/gql/transport.ts`

```ts
export type GraphqlError = {
  message: string
  path?: string[]
  extensions?: Record<string, unknown>
}

export type GraphqlRawResult<TData> = {
  data?: TData
  errors?: GraphqlError[]
}

export interface GraphqlTransport {
  execute<TData>(query: string, variables?: GraphqlVariables): Promise<TData>
  executeRaw<TData>(query: string, variables?: GraphqlVariables): Promise<GraphqlRawResult<TData>>
}
```

In `createTokenTransport`:
- Add `executeRaw()` that returns `{ data, errors }` without throwing on
  `payload.errors`, but still throws on HTTP-level failures (`!response.ok`)
  and missing/non-JSON responses
- Refactor `execute()` to call `executeRaw()` internally and throw if errors
  present (preserving existing behavior)

### 3b. Add `queryRaw` to `GraphqlClient`

**File:** `packages/core/src/gql/transport.ts`

```ts
export interface GraphqlClient {
  query<TData, TVars extends GraphqlVariables = GraphqlVariables>(
    query: GraphqlDocument, variables?: TVars,
  ): Promise<TData>
  queryRaw<TData, TVars extends GraphqlVariables = GraphqlVariables>(
    query: GraphqlDocument, variables?: TVars,
  ): Promise<GraphqlRawResult<TData>>
}
```

Update `createGraphqlClient()` to add `queryRaw` delegating to
`transport.executeRaw()`.

### 3c. Add `queryRaw` to `GithubClient`

**File:** `packages/core/src/gql/github-client.ts`

- Add `queryRaw` to `GithubClient` interface (inherits from `GraphqlClient`
  update)
- In `createGithubClient()` factory, the `queryRaw` method is already
  available from the underlying `GraphqlClient`

### 3d. Update `executeTasks()` Phase 2 to use `queryRaw`

**File:** `packages/core/src/core/routing/engine.ts`

Replace the Phase 2 try/catch block (lines 437–461):

```ts
// Before (throws on any error, killing all steps):
rawMutResult = (await deps.githubClient.query(document, variables)) as Record<string, unknown>

// After (receives partial data + errors):
const rawResponse = await deps.githubClient.queryRaw<Record<string, unknown>>(document, variables)

// Build error map: stepAlias → error message
const stepErrors = new Map<string, string>()
if (rawResponse.errors?.length) {
  for (const err of rawResponse.errors) {
    // GitHub GQL errors include path like ["step0", "createIssue"]
    const alias = err.path?.[0]
    if (typeof alias === "string" && alias.startsWith("step")) {
      stepErrors.set(alias, err.message)
    }
  }
  // If errors don't have per-step paths, fall back to marking all as failed
  if (stepErrors.size === 0) {
    for (const { alias } of mutationInputs) {
      stepErrors.set(alias, rawResponse.errors[0]?.message ?? "GraphQL batch error")
    }
  }
}

rawMutResult = rawResponse.data ?? {}
```

Then in the result assembly loop, check `stepErrors`:
```ts
if (stepErrors.has(mutInput.alias)) {
  return {
    task: req.task,
    ok: false,
    error: {
      code: mapErrorToCode(new Error(stepErrors.get(mutInput.alias)!)),
      message: stepErrors.get(mutInput.alias)!,
      retryable: false,
    },
  }
}
```

Keep existing catch block for transport-level failures (network errors, HTTP
errors) that prevent any response from being received.

### 3e. Update `executeGraphqlRequest` in chain.ts

**File:** `packages/core/src/cli/commands/chain.ts`

The `executeGraphqlRequest` function used as the transport for `chain` CLI
command also needs to satisfy the new `GraphqlTransport` interface by
implementing `executeRaw()`:

- Add `executeRawGraphqlRequest()` that returns `{ data, errors }` without
  throwing on `payload.errors`
- The inline transport object passed to `createGithubClient()` must include
  both `execute` and `executeRaw`

### 3f. Update documentation

**File:** `docs/guides/chaining-capabilities.md`

The "Step-level errors" section (lines 212–215) already describes the correct
behavior. Add a note clarifying error path mapping:
```
Errors are mapped back to steps via the `path` field in each GraphQL error
(e.g., `["step0", "createIssue"]`). If the error cannot be attributed to a
specific step, all steps in the batch are marked failed.
```

### 3g. Tests

**File:** `packages/core/test/unit/transport.test.ts` (new)

Test cases for `createTokenTransport`:
1. `executeRaw` returns `{ data, errors: undefined }` on clean response
2. `executeRaw` returns `{ data, errors }` on partial success (HTTP 200 with
   errors[] + partial data)
3. `executeRaw` throws on HTTP error (`!response.ok`)
4. `execute` still throws on `errors[]` (backward compat)

**File:** `packages/core/test/unit/engine.test.ts` (append)

Test cases for `executeTasks` partial error handling:
1. "Phase 2 partial failure: one step errors, other succeeds → status partial"
   - Mock `queryRaw` returning `{ data: { step0: {...}, step1: null }, errors: [{ message: "...", path: ["step1", "createIssue"] }] }`
   - Assert `result.status === "partial"`, step0 ok, step1 failed
2. "Phase 2 unattributed error: errors without path → all steps failed"
   - Mock `queryRaw` returning `{ data: {}, errors: [{ message: "server error" }] }`
   - Assert `result.status === "failed"`, all steps failed
3. "Phase 2 clean response: no errors → status success" (regression)

---

## Item 5 — Expand chainable coverage for CLI-only mutations

**Goal:** Add GraphQL routes to 4 CLI-only capabilities so they can participate
in chains.

### Design Decision: Input Schema Strategy

The 4 target cards use CLI-style inputs (`owner`, `name`, `issueNumber`). The
existing GQL-capable cards (e.g., `issue.labels.add`) use node IDs (`issueId`).

**Approach:** Create new lookup queries that accept `owner/name/issueNumber` and
return the issue node ID plus any required resolution data. This keeps the
existing card input schemas unchanged and adds GraphQL as a **new preferred
route** while retaining CLI as a fallback.

New lookup queries needed:
- `IssueNodeIdLookup` — resolves `owner/name/issueNumber` → issue node ID
  (used by `issue.milestone.clear`)
- `IssueLabelsLookupByNumber` — resolves `owner/name/issueNumber` → issue
  node ID + repository label nodes (used by `issue.labels.remove`)
- `IssueAssigneesLookupByNumber` — resolves `owner/name/issueNumber` → issue
  node ID + assignable user nodes (used by `issue.assignees.add`,
  `issue.assignees.remove`)

### 5a. New GraphQL lookup queries

**File:** `packages/core/src/gql/operations/issue-node-id-lookup.graphql` (new)

```graphql
query IssueNodeIdLookup($owner: String!, $name: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $issueNumber) {
      id
    }
  }
}
```

**File:** `packages/core/src/gql/operations/issue-labels-lookup-by-number.graphql` (new)

```graphql
query IssueLabelsLookupByNumber($owner: String!, $name: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $issueNumber) {
      id
    }
    labels(first: 100) {
      nodes {
        id
        name
      }
    }
  }
}
```

**File:** `packages/core/src/gql/operations/issue-assignees-lookup-by-number.graphql` (new)

```graphql
query IssueAssigneesLookupByNumber($owner: String!, $name: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $issueNumber) {
      id
    }
    assignableUsers(first: 100) {
      nodes {
        id
        login
      }
    }
  }
}
```

### 5b. New GraphQL mutation files

**File:** `packages/core/src/gql/operations/issue-labels-remove.graphql` (new)

```graphql
mutation IssueLabelsRemove($labelableId: ID!, $labelIds: [ID!]!) {
  removeLabelsFromLabelable(input: { labelableId: $labelableId, labelIds: $labelIds }) {
    labelable {
      ... on Issue {
        id
        labels(first: 50) {
          nodes {
            name
          }
        }
      }
    }
  }
}
```

**File:** `packages/core/src/gql/operations/issue-assignees-add.graphql` (new)

```graphql
mutation IssueAssigneesAdd($assignableId: ID!, $assigneeIds: [ID!]!) {
  addAssigneesToAssignable(input: { assignableId: $assignableId, assigneeIds: $assigneeIds }) {
    assignable {
      ... on Issue {
        id
        assignees(first: 50) {
          nodes {
            login
          }
        }
      }
    }
  }
}
```

**File:** `packages/core/src/gql/operations/issue-assignees-remove.graphql` (new)

```graphql
mutation IssueAssigneesRemove($assignableId: ID!, $assigneeIds: [ID!]!) {
  removeAssigneesFromAssignable(input: { assignableId: $assignableId, assigneeIds: $assigneeIds }) {
    assignable {
      ... on Issue {
        id
        assignees(first: 50) {
          nodes {
            login
          }
        }
      }
    }
  }
}
```

**Note:** `issue.milestone.clear` does NOT need a new mutation file. It reuses
the existing `IssueMilestoneSet` mutation (`updateIssue` with
`$milestoneId: ID` — already nullable). Passing `milestoneId: null` clears the
milestone.

### 5c. Run codegen

```bash
pnpm --filter @ghx-dev/core run gql:codegen
```

This generates `.generated.ts` files for all new `.graphql` files.

### 5d. Register in document-registry.ts

**File:** `packages/core/src/gql/document-registry.ts`

Add imports for new generated documents and register:

```ts
// New lookup registrations
LOOKUP_DOCUMENTS["IssueNodeIdLookup"] = IssueNodeIdLookupDocument
LOOKUP_DOCUMENTS["IssueLabelsLookupByNumber"] = IssueLabelsLookupByNumberDocument
LOOKUP_DOCUMENTS["IssueAssigneesLookupByNumber"] = IssueAssigneesLookupByNumberDocument

// New mutation registrations
MUTATION_DOCUMENTS["IssueLabelsRemove"] = IssueLabelsRemoveDocument
MUTATION_DOCUMENTS["IssueAssigneesAdd"] = IssueAssigneesAddDocument
MUTATION_DOCUMENTS["IssueAssigneesRemove"] = IssueAssigneesRemoveDocument
// IssueMilestoneSet already registered — reused for milestone.clear
```

### 5e. Update operation card YAMLs

**File:** `packages/core/src/core/registry/cards/issue.labels.remove.yaml`

Add `graphql:` block, change preferred route to `graphql`, add `cli` as
fallback:

```yaml
routing:
  preferred: graphql
  fallbacks: [cli]

graphql:
  operationName: IssueLabelsRemove
  documentPath: src/gql/operations/issue-labels-remove.graphql
  resolution:
    lookup:
      operationName: IssueLabelsLookupByNumber
      documentPath: src/gql/operations/issue-labels-lookup-by-number.graphql
      vars:
        owner: owner
        name: name
        issueNumber: issueNumber
    inject:
      - target: labelableId
        source: scalar
        path: repository.issue.id
      - target: labelIds
        source: map_array
        from_input: labels
        nodes_path: repository.labels.nodes
        match_field: name
        extract_field: id
```

**File:** `packages/core/src/core/registry/cards/issue.assignees.add.yaml`

```yaml
routing:
  preferred: graphql
  fallbacks: [cli]

graphql:
  operationName: IssueAssigneesAdd
  documentPath: src/gql/operations/issue-assignees-add.graphql
  resolution:
    lookup:
      operationName: IssueAssigneesLookupByNumber
      documentPath: src/gql/operations/issue-assignees-lookup-by-number.graphql
      vars:
        owner: owner
        name: name
        issueNumber: issueNumber
    inject:
      - target: assignableId
        source: scalar
        path: repository.issue.id
      - target: assigneeIds
        source: map_array
        from_input: assignees
        nodes_path: repository.assignableUsers.nodes
        match_field: login
        extract_field: id
```

**File:** `packages/core/src/core/registry/cards/issue.assignees.remove.yaml`

Same structure as `issue.assignees.add` but with operation name
`IssueAssigneesRemove`.

**File:** `packages/core/src/core/registry/cards/issue.milestone.clear.yaml`

```yaml
routing:
  preferred: graphql
  fallbacks: [cli]

graphql:
  operationName: IssueMilestoneSet
  documentPath: src/gql/operations/issue-milestone-set.graphql
  resolution:
    lookup:
      operationName: IssueNodeIdLookup
      documentPath: src/gql/operations/issue-node-id-lookup.graphql
      vars:
        owner: owner
        name: name
        issueNumber: issueNumber
    inject:
      - target: issueId
        source: scalar
        path: repository.issue.id
```

For `issue.milestone.clear`, the mutation receives `milestoneId` as `undefined`
(not in input, not in resolved) — which the variable binding will omit, and
since `$milestoneId: ID` is nullable, GitHub interprets this as clearing the
milestone. However, to explicitly pass `null`, we need a small addition to
`buildMutationVars` — see 5f.

### 5f. Handle explicit null for milestone clear

**File:** `packages/core/src/gql/resolve.ts`

Add a new inject source type `"null_literal"` to handle milestone clear:

```ts
// In applyInject:
if (spec.source === "null_literal") {
  return { [spec.target]: null }
}
```

**File:** `packages/core/src/core/registry/types.ts`

Add to `InjectSpec` union:

```ts
export interface NullLiteralInject {
  target: string
  source: "null_literal"
}

export type InjectSpec = ScalarInject | MapArrayInject | InputPassthroughInject | NullLiteralInject
```

Then update the `issue.milestone.clear` card's inject to include:

```yaml
    inject:
      - target: issueId
        source: scalar
        path: repository.issue.id
      - target: milestoneId
        source: "null_literal"
```

### 5g. Tests

**File:** `packages/core/test/unit/engine.test.ts` (append)

Test: "issue.labels.remove chain resolves labelableId + labelIds via
IssueLabelsLookupByNumber"
- 2-step chain: `issue.close` (no resolution) + `issue.labels.remove` (with
  resolution)
- Mock Phase 1 returning label lookup data
- Mock Phase 2 returning mutation result
- Assert both steps succeed

Test: "issue.milestone.clear chain passes null milestoneId"
- Mock `buildMutationVars` and verify the output includes `milestoneId: null`

**File:** `packages/core/test/unit/resolve.test.ts` (append or new)

Test: "`null_literal` inject returns `{ target: null }`"

### 5h. Run GQL verify + full CI

```bash
pnpm run ghx:gql:verify
pnpm run ci --outputStyle=static
```

---

## Files Changed Summary

| File | Change | Item |
|------|--------|------|
| `packages/core/src/gql/transport.ts` | Add `executeRaw`, `GraphqlError`, `GraphqlRawResult` types | 3 |
| `packages/core/src/gql/github-client.ts` | Add `queryRaw` to interface + factory | 3 |
| `packages/core/src/core/routing/engine.ts` | Phase 2 uses `queryRaw`, wire resolution cache | 3, 6 |
| `packages/core/src/cli/commands/chain.ts` | Add `executeRaw` to inline transport | 3 |
| `packages/core/src/core/routing/resolution-cache.ts` | New module | 6 |
| `packages/core/src/core/registry/types.ts` | Add `NullLiteralInject` | 5 |
| `packages/core/src/gql/resolve.ts` | Handle `null_literal` source | 5 |
| `packages/core/src/gql/document-registry.ts` | Register 6 new documents | 5 |
| `packages/core/src/gql/operations/*.graphql` | 6 new files (3 lookups, 3 mutations) | 5 |
| `packages/core/src/core/registry/cards/*.yaml` | Update 4 cards | 5 |
| `packages/core/src/index.ts` | Export cache utilities | 6 |
| `docs/guides/chaining-capabilities.md` | Clarify error path mapping | 3 |
| `packages/core/test/unit/pr-review-resolution.test.ts` | New test file | 8 |
| `packages/core/test/unit/resolution-cache.test.ts` | New test file | 6 |
| `packages/core/test/unit/transport.test.ts` | New test file | 3 |
| `packages/core/test/unit/engine.test.ts` | Additional test cases | 3, 5, 6, 8 |
| `packages/core/test/unit/resolve.test.ts` | `null_literal` test | 5 |

---

## Risk Assessment

| Item | Risk | Mitigation |
|------|------|------------|
| 3 | `GraphqlTransport` interface change is breaking for external implementors | `executeRaw` is additive; `execute` contract unchanged |
| 3 | chain.ts inline transport must implement both methods | Straightforward refactor of existing `executeGraphqlRequest` |
| 5 | New lookup queries may return unexpected shapes from GitHub API | Test with real API calls before merging (manual validation) |
| 5 | `null_literal` adds to `InjectSpec` union — existing YAML parsing must handle it | Add to YAML validation schema; unit test covers it |
| 6 | Cache key stability depends on JSON.stringify determinism | Sort keys before stringify; test explicitly |
| 8 | Low risk — test-only changes | N/A |
