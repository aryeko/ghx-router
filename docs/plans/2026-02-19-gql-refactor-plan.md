# GQL Layer Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the 2,284-line `gql/client.ts` monolith into domain modules, rename `common-types.ts` to follow `.generated` convention, migrate inline GQL strings to codegen, and replace the capability if-chain with a registry-driven dispatch.

**Architecture:** The GQL layer gets decomposed into transport (raw execution), types (pure type exports), assertions (validation), domain modules (operation logic), and a thin facade (`github-client.ts`). A handler registry replaces the hardcoded capability dispatch.

**Tech Stack:** TypeScript strict ESM, graphql-codegen with `near-operation-file` preset, Vitest, Biome formatting.

---

## Phase 1: Rename `common-types.ts` (smallest change, validates codegen pipeline)

### Task 1: Rename common-types.ts to follow .generated convention

**Files:**
- Rename: `packages/core/src/gql/generated/common-types.ts` → `packages/core/src/gql/generated/common-types.generated.ts`
- Modify: `packages/core/codegen.ts:25` — update `baseTypesPath`
- Modify: All `packages/core/src/gql/operations/*.generated.ts` — update import path (30 files)

**Step 1: Rename the file**

```bash
cd /Users/aryekogan/repos/ghx/.worktrees/gql-refactor
git mv packages/core/src/gql/generated/common-types.ts packages/core/src/gql/generated/common-types.generated.ts
```

**Step 2: Update codegen.ts baseTypesPath**

In `packages/core/codegen.ts`, change line 25:
```ts
// OLD
baseTypesPath: "../generated/common-types.js",
// NEW
baseTypesPath: "../generated/common-types.generated.js",
```

**Step 3: Update all generated file imports**

Find-and-replace across all `packages/core/src/gql/operations/**/*.generated.ts` files:
```
// OLD
import type * as Types from "../generated/common-types.js"
// NEW
import type * as Types from "../generated/common-types.generated.js"
```

And for fragments (two levels deep):
```
// OLD
import type * as Types from "../../generated/common-types.js"
// NEW
import type * as Types from "../../generated/common-types.generated.js"
```

**Step 4: Run tests to verify**

```bash
pnpm run test
```
Expected: All 474 tests pass.

**Step 5: Run typecheck**

```bash
pnpm run typecheck
```
Expected: No errors.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor(gql): rename common-types.ts to common-types.generated.ts"
```

---

## Phase 2: Extract transport, types, and assertions from client.ts

### Task 2: Extract transport.ts

**Files:**
- Create: `packages/core/src/gql/transport.ts`
- Modify: `packages/core/src/gql/client.ts` — remove extracted code, add import

**Step 1: Create transport.ts**

Extract from `client.ts` lines 1-2, 29-42, 2143-2228 into `packages/core/src/gql/transport.ts`:

```ts
import { type DocumentNode, print } from "graphql"
import type { RequestDocument } from "graphql-request"

export type GraphqlVariables = Record<string, unknown>
type GraphqlDocument = string | DocumentNode
type QueryLike = GraphqlDocument | RequestDocument

export interface GraphqlTransport {
  execute<TData>(query: string, variables?: GraphqlVariables): Promise<TData>
}

export interface GraphqlClient {
  query<TData, TVariables extends GraphqlVariables = GraphqlVariables>(
    query: GraphqlDocument,
    variables?: TVariables,
  ): Promise<TData>
}

export function queryToString(query: QueryLike): string {
  if (typeof query === "string") {
    return query
  }

  if (typeof query === "object" && query !== null && "kind" in query) {
    return print(query as DocumentNode)
  }

  return String(query)
}

export function assertQuery(query: string): void {
  if (query.trim().length === 0) {
    throw new Error("GraphQL query must be non-empty")
  }
}

export function createGraphqlClient(transport: GraphqlTransport): GraphqlClient {
  return {
    async query<TData, TVariables extends GraphqlVariables = GraphqlVariables>(
      query: GraphqlDocument,
      variables?: TVariables,
    ): Promise<TData> {
      const queryText = queryToString(query)
      assertQuery(queryText)
      return transport.execute<TData>(queryText, variables)
    },
  }
}

const DEFAULT_GRAPHQL_URL = "https://api.github.com/graphql"

function resolveGraphqlUrl(): string {
  if (process.env.GITHUB_GRAPHQL_URL) {
    return process.env.GITHUB_GRAPHQL_URL
  }

  if (process.env.GH_HOST) {
    return `https://${process.env.GH_HOST}/api/graphql`
  }

  return DEFAULT_GRAPHQL_URL
}

export function createTokenTransport(token: string, graphqlUrl?: string): GraphqlTransport {
  const url = graphqlUrl ?? resolveGraphqlUrl()

  return {
    async execute<TData>(query: string, variables?: GraphqlVariables): Promise<TData> {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables: variables ?? {} }),
      })

      const payload = (await response.json()) as {
        data?: TData
        errors?: Array<{ message?: string }>
        message?: string
      }

      if (!response.ok) {
        throw new Error(payload.message ?? `GraphQL request failed (${response.status})`)
      }

      if (payload.errors?.length) {
        throw new Error(payload.errors[0]?.message ?? "GraphQL returned errors")
      }

      if (payload.data === undefined) {
        throw new Error("GraphQL response missing data")
      }

      return payload.data
    },
  }
}

export type TokenClientOptions = {
  token: string
  graphqlUrl?: string
}
```

**Step 2: Update client.ts to import from transport.ts**

Replace the extracted sections in `client.ts` with:
```ts
import {
  type GraphqlClient,
  type GraphqlTransport,
  type GraphqlVariables,
  type TokenClientOptions,
  assertQuery,
  createGraphqlClient,
  createTokenTransport,
  queryToString,
} from "./transport.js"

export type { GraphqlClient, GraphqlTransport, GraphqlVariables, TokenClientOptions }
```

Remove the original definitions of `GraphqlVariables`, `GraphqlDocument`, `QueryLike`, `GraphqlTransport`, `GraphqlClient`, `queryToString`, `assertQuery`, `createGraphqlClient`, `DEFAULT_GRAPHQL_URL`, `resolveGraphqlUrl`, `createTokenTransport`, `TokenClientOptions` from `client.ts`.

**Step 3: Run tests**

```bash
pnpm run test
```
Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/core/src/gql/transport.ts packages/core/src/gql/client.ts
git commit -m "refactor(gql): extract transport.ts from client.ts"
```

---

### Task 3: Extract types.ts

**Files:**
- Create: `packages/core/src/gql/types.ts`
- Modify: `packages/core/src/gql/client.ts` — remove type definitions, re-export from types.ts

**Step 1: Create types.ts**

Move all `export type *Input` and `export type *Data` definitions from `client.ts` (lines 44-382) into `packages/core/src/gql/types.ts`. These are the types starting with `RepoViewInput` through `ReviewThreadMutationData`, plus `PrCommentsListInput`, `IssueCreateInput`, etc.

Also move the codegen variable type re-exports (`RepoViewInput = RepoViewQueryVariables`, etc.) — but these depend on the generated `.generated.ts` files, so import those in `types.ts`.

**Step 2: Update client.ts to import and re-export from types.ts**

```ts
export type { /* all type names */ } from "./types.js"
// Also import the types used within client.ts functions
import type { /* needed types */ } from "./types.js"
```

**Step 3: Run tests**

```bash
pnpm run test
```
Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/core/src/gql/types.ts packages/core/src/gql/client.ts
git commit -m "refactor(gql): extract types.ts from client.ts"
```

---

### Task 4: Extract assertions.ts

**Files:**
- Create: `packages/core/src/gql/assertions.ts`
- Modify: `packages/core/src/gql/client.ts` — remove assertion functions, import from assertions.ts

**Step 1: Create assertions.ts**

Move all `assert*` functions and helpers (`assertRepoInput`, `assertIssueInput`, `assertIssueListInput`, `assertIssueCommentsListInput`, `assertNonEmptyString`, `assertOptionalString`, `assertStringArray`, `assertIssueCreateInput`, etc.) plus the `asRecord` helper from `client.ts` into `packages/core/src/gql/assertions.ts`.

Import the needed types from `./types.js`.

**Step 2: Update client.ts**

Add `import { ... } from "./assertions.js"` for all assertion functions used by the remaining operation runners.

**Step 3: Run tests**

```bash
pnpm run test
```
Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/core/src/gql/assertions.ts packages/core/src/gql/client.ts
git commit -m "refactor(gql): extract assertions.ts from client.ts"
```

---

## Phase 3: Extract domain modules

### Task 5: Extract domains/repo.ts

**Files:**
- Create: `packages/core/src/gql/domains/repo.ts`
- Modify: `packages/core/src/gql/client.ts` — remove `runRepoView`, import from domain module

**Step 1: Create domains/repo.ts**

Move `runRepoView` function. Import SDK from `../operations/repo-view.generated.js`, types from `../types.js`, assertions from `../assertions.js`.

Export the function and the `SdkClients["repo"]` type needed for the SDK client.

**Step 2: Update client.ts**

Import `runRepoView` from `./domains/repo.js` and use it in `createGithubClient`.

**Step 3: Run tests**

```bash
pnpm run test
```

**Step 4: Commit**

```bash
git add packages/core/src/gql/domains/repo.ts packages/core/src/gql/client.ts
git commit -m "refactor(gql): extract domains/repo.ts"
```

---

### Task 6: Extract domains/issue-queries.ts

**Files:**
- Create: `packages/core/src/gql/domains/issue-queries.ts`
- Modify: `packages/core/src/gql/client.ts`

**Step 1: Create domains/issue-queries.ts**

Move: `runIssueView`, `runIssueList`, `runIssueCommentsList` and their SDK type dependencies.

**Step 2: Update client.ts, run tests, commit**

```bash
git commit -m "refactor(gql): extract domains/issue-queries.ts"
```

---

### Task 7: Extract domains/issue-mutations.ts

**Files:**
- Create: `packages/core/src/gql/domains/issue-mutations.ts`
- Modify: `packages/core/src/gql/client.ts`

**Step 1: Create domains/issue-mutations.ts**

Move: `parseIssueNode`, `parseIssueRelationNode`, `runIssueCreate`, `runIssueUpdate`, `runIssueClose`, `runIssueReopen`, `runIssueDelete`, `runIssueLabelsUpdate`, `runIssueLabelsAdd`, `runIssueAssigneesUpdate`, `runIssueMilestoneSet`, `runIssueCommentCreate`, `runIssueLinkedPrsList`, `runIssueRelationsGet`, `runIssueParentSet`, `runIssueParentRemove`, `runIssueBlockedByAdd`, `runIssueBlockedByRemove`.

Also move the inline GQL strings these functions use (e.g., `ISSUE_CREATE_MUTATION`, `ISSUE_CREATE_REPOSITORY_ID_QUERY`, etc.).

**Step 2: Update client.ts, run tests, commit**

```bash
git commit -m "refactor(gql): extract domains/issue-mutations.ts"
```

---

### Task 8: Extract domains/pr-queries.ts

**Files:**
- Create: `packages/core/src/gql/domains/pr-queries.ts`
- Modify: `packages/core/src/gql/client.ts`

**Step 1: Create domains/pr-queries.ts**

Move: `runPrView`, `runPrList`, `runPrReviewsList`, `runPrDiffListFiles`, `runPrMergeStatus` and the `PR_MERGE_STATUS_QUERY` inline string.

**Step 2: Update client.ts, run tests, commit**

```bash
git commit -m "refactor(gql): extract domains/pr-queries.ts"
```

---

### Task 9: Extract domains/pr-mutations.ts

**Files:**
- Create: `packages/core/src/gql/domains/pr-mutations.ts`
- Modify: `packages/core/src/gql/client.ts`

**Step 1: Create domains/pr-mutations.ts**

Move: `runPrCommentsList` (with its filtering/scanning logic, `MAX_PR_REVIEW_THREAD_SCAN_PAGES`, `normalizePrReviewThread`, `normalizePrReviewThreadComment`), `runReplyToReviewThread`, `runResolveReviewThread`, `runUnresolveReviewThread`, and their inline GQL strings (`PR_COMMENTS_LIST_QUERY`, `PR_COMMENT_REPLY_MUTATION`, `PR_COMMENT_RESOLVE_MUTATION`, `PR_COMMENT_UNRESOLVE_MUTATION`, `REVIEW_THREAD_STATE_QUERY`).

**Step 2: Update client.ts, run tests, commit**

```bash
git commit -m "refactor(gql): extract domains/pr-mutations.ts"
```

---

### Task 10: Create github-client.ts facade and delete client.ts

**Files:**
- Create: `packages/core/src/gql/github-client.ts`
- Modify: `packages/core/src/index.ts` — update import paths
- Modify: `packages/core/src/cli/commands/run.ts` — update import path
- Modify: `packages/core/src/core/routing/engine.ts` — update import path
- Modify: `packages/core/src/core/execution/adapters/graphql-adapter.ts` — update import path
- Modify: `packages/core/src/core/execution/adapters/graphql-capability-adapter.ts` — update import path
- Delete: `packages/core/src/gql/client.ts`
- Modify: All test files that import from `client.ts`

**Step 1: Create github-client.ts**

This file contains:
- The `GithubClient` interface
- `createGithubClient(transport)` factory
- `createGithubClientFromToken(tokenOrOptions)` factory
- The `SdkClients` type and `createSdkClients` helper
- Imports all domain modules and wires them into the facade

**Step 2: Update all imports**

Update every file that currently imports from `../../gql/client.js` (or similar paths) to import from the appropriate new module:
- Types → `./gql/types.js`
- `GraphqlClient`, `GraphqlTransport` → `./gql/transport.js`
- `GithubClient`, `createGithubClient`, `createGithubClientFromToken` → `./gql/github-client.js`

**Step 3: Update `packages/core/src/index.ts`**

Change the import sources but keep the same public exports.

**Step 4: Delete `packages/core/src/gql/client.ts`**

**Step 5: Update test files**

Update imports in:
- `test/unit/github-client.test.ts`
- `test/unit/github-client-sdk.test.ts`
- `test/unit/github-graphql-client-ops.test.ts`

**Step 6: Run full CI**

```bash
pnpm run ci --outputStyle=static
```
Expected: All checks pass.

**Step 7: Commit**

```bash
git commit -m "refactor(gql): replace client.ts with github-client.ts facade and domain modules"
```

---

## Phase 4: Registry-driven capability dispatch

### Task 11: Create capability handler registry

**Files:**
- Create: `packages/core/src/gql/capability-registry.ts`

**Step 1: Create the registry module**

```ts
import type { GithubClient } from "./github-client.js"

export type GraphqlHandler = (
  client: GithubClient,
  params: Record<string, unknown>,
) => Promise<unknown>

const handlers = new Map<string, GraphqlHandler>()

export function registerGraphqlHandlers(entries: Record<string, GraphqlHandler>): void {
  for (const [id, handler] of Object.entries(entries)) {
    handlers.set(id, handler)
  }
}

export function getGraphqlHandler(capabilityId: string): GraphqlHandler | undefined {
  return handlers.get(capabilityId)
}

export function listGraphqlCapabilities(): string[] {
  return [...handlers.keys()]
}
```

**Step 2: Commit**

```bash
git commit -m "refactor(gql): add capability handler registry"
```

---

### Task 12: Register handlers from domain modules

**Files:**
- Modify: `packages/core/src/gql/domains/repo.ts`
- Modify: `packages/core/src/gql/domains/issue-queries.ts`
- Modify: `packages/core/src/gql/domains/issue-mutations.ts`
- Modify: `packages/core/src/gql/domains/pr-queries.ts`
- Modify: `packages/core/src/gql/domains/pr-mutations.ts`
- Create: `packages/core/src/gql/register-all-handlers.ts` — imports all domain modules to trigger registration

**Step 1: Add handler exports to each domain module**

Each domain module exports a `handlers` record mapping capability IDs to functions. Example for `repo.ts`:

```ts
import type { GraphqlHandler } from "../capability-registry.js"
import type { RepoViewInput } from "../types.js"

export const repoHandlers: Record<string, GraphqlHandler> = {
  "repo.view": (client, params) => client.fetchRepoView(params as RepoViewInput),
}
```

**Step 2: Create register-all-handlers.ts**

```ts
import { registerGraphqlHandlers } from "./capability-registry.js"
import { issueQueryHandlers } from "./domains/issue-queries.js"
import { issueMutationHandlers } from "./domains/issue-mutations.js"
import { prQueryHandlers } from "./domains/pr-queries.js"
import { prMutationHandlers } from "./domains/pr-mutations.js"
import { repoHandlers } from "./domains/repo.js"

registerGraphqlHandlers(repoHandlers)
registerGraphqlHandlers(issueQueryHandlers)
registerGraphqlHandlers(issueMutationHandlers)
registerGraphqlHandlers(prQueryHandlers)
registerGraphqlHandlers(prMutationHandlers)
```

**Step 3: Run tests, commit**

```bash
git commit -m "refactor(gql): register capability handlers from domain modules"
```

---

### Task 13: Replace if-chain in graphql-capability-adapter.ts

**Files:**
- Modify: `packages/core/src/core/execution/adapters/graphql-capability-adapter.ts`

**Step 1: Rewrite runGraphqlCapability**

Replace the entire if-chain with registry lookup. Import `getGraphqlHandler` from `../../../gql/capability-registry.js` and `../../../gql/register-all-handlers.js` (side-effect import to ensure registration).

```ts
import "../../../gql/register-all-handlers.js"
import { getGraphqlHandler } from "../../../gql/capability-registry.js"
import type { GithubClient } from "../../../gql/github-client.js"
import type { ResultEnvelope } from "../../contracts/envelope.js"
import { mapErrorToCode } from "../../errors/map-error.js"
import { isRetryableErrorCode } from "../../errors/retryability.js"
import { normalizeError, normalizeResult } from "../normalizer.js"

export async function runGraphqlCapability(
  client: GithubClient,
  capabilityId: string,
  params: Record<string, unknown>,
): Promise<ResultEnvelope> {
  try {
    const handler = getGraphqlHandler(capabilityId)
    if (!handler) {
      return normalizeError(
        {
          code: errorCodes.AdapterUnsupported,
          message: `Unsupported GraphQL capability: ${capabilityId}`,
          retryable: false,
        },
        "graphql",
        { capabilityId, reason: "CAPABILITY_LIMIT" },
      )
    }
    const data = await handler(client, params)
    return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "graphql",
      { capabilityId, reason: "CARD_PREFERRED" },
    )
  }
}
```

**Step 2: Remove the `GraphqlCapabilityId` type union if no longer needed, or derive it from the registry**

**Step 3: Update engine.ts** — remove the `GraphqlCapabilityId` cast if the function signature now accepts `string`.

**Step 4: Run full CI**

```bash
pnpm run ci --outputStyle=static
```
Expected: All checks pass.

**Step 5: Commit**

```bash
git commit -m "refactor(gql): replace capability if-chain with registry dispatch"
```

---

## Phase 5: Migrate inline GQL strings to codegen (optional, can be separate PR)

> **Note:** This phase requires `GITHUB_TOKEN` env var for `graphql-codegen` to introspect GitHub's schema. If not available, skip and do in a follow-up PR.

### Task 14: Create missing .graphql files

**Files to create:**
- `packages/core/src/gql/operations/pr-merge-status.graphql`
- `packages/core/src/gql/operations/review-thread-state.graphql`
- `packages/core/src/gql/operations/issue-labels-lookup.graphql`
- `packages/core/src/gql/operations/issue-assignees-lookup.graphql`
- `packages/core/src/gql/operations/issue-milestone-lookup.graphql`
- `packages/core/src/gql/operations/issue-parent-lookup.graphql`
- `packages/core/src/gql/operations/issue-labels-add.graphql`
- `packages/core/src/gql/operations/issue-repository-id.graphql`

Copy the inline GQL strings from the domain modules into these `.graphql` files (one operation per file).

### Task 15: Run codegen and verify

```bash
GITHUB_TOKEN=$GITHUB_TOKEN pnpm --filter @ghx-dev/core exec graphql-codegen
pnpm run ghx:gql:check
```

### Task 16: Switch domain modules to use generated SDKs

For each domain module, replace `graphqlClient.query<unknown>(INLINE_STRING, vars)` calls with the generated SDK method calls (same pattern as `runRepoView` currently uses).

### Task 17: Remove all inline GQL strings from domain modules

Delete the `const *_QUERY = \`...\`` and `const *_MUTATION = \`...\`` template literals.

### Task 18: Run full CI, commit

```bash
pnpm run ci --outputStyle=static
git commit -m "refactor(gql): migrate all inline GQL strings to codegen"
```

---

## Final Verification

After all phases:

```bash
pnpm run ci --outputStyle=static
```

All 474+ tests pass, typecheck clean, lint clean, format clean.

---

## Summary of new file structure

```
packages/core/src/gql/
  transport.ts                  # GraphqlTransport, GraphqlClient, createGraphqlClient, token transport
  types.ts                      # All *Input/*Data types (pure types)
  assertions.ts                 # All assert* validation helpers, asRecord
  github-client.ts              # GithubClient interface + factories
  capability-registry.ts        # Handler map + register/get functions
  register-all-handlers.ts      # Side-effect import that registers all domain handlers
  generated/
    common-types.generated.ts   # Renamed from common-types.ts
  domains/
    repo.ts                     # runRepoView + handler export
    issue-queries.ts            # runIssueView, runIssueList, runIssueCommentsList + handlers
    issue-mutations.ts          # All issue mutation runners + handlers
    pr-queries.ts               # runPrView, runPrList, runPrReviewsList, runPrDiffListFiles, runPrMergeStatus + handlers
    pr-mutations.ts             # runPrCommentsList, runReplyToReviewThread, resolve/unresolve + handlers
  operations/                   # Unchanged — .graphql files + .generated.ts codegen output
    fragments/
```

**Deleted:** `packages/core/src/gql/client.ts`
