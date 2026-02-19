# GQL Layer Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the 2,284-line `gql/client.ts` monolith into lazily-loaded domain modules so each operation only loads its own code on first use, rename `common-types.ts` to follow `.generated` convention, migrate inline GQL strings to codegen, and replace the capability if-chain with a registry-driven dispatch.

**Architecture:** The GQL layer decomposes into transport (raw execution), types (pure type exports), assertions (validation), domain modules (operation logic), and a thin facade (`github-client.ts`). The facade uses `await import()` to lazily load domain modules — only the code for the capability actually invoked gets evaluated. A handler registry replaces the hardcoded capability dispatch. The `SdkClients` type is eliminated; each domain module creates its own SDK internally.

**Tech Stack:** TypeScript strict ESM, graphql-codegen with `near-operation-file` preset, Vitest, Biome formatting.

**Why this optimizes startup:** Currently, importing `createGithubClient` evaluates all 2,284 lines of `client.ts` plus 8 generated SDK modules — even if you only call one method. After this refactor, importing `createGithubClient` evaluates only `github-client.ts` (~60 lines) + `transport.ts` (~80 lines). The remaining ~2,100 lines of domain logic are loaded on-demand per first method call.

---

## Phase 1: Rename `common-types.ts` (smallest change, validates codegen pipeline)

### Task 1: Rename common-types.ts to follow .generated convention

**Files:**
- Rename: `packages/core/src/gql/generated/common-types.ts` → `packages/core/src/gql/generated/common-types.generated.ts`
- Modify: `packages/core/codegen.ts:25` — update `baseTypesPath`
- Modify: All `packages/core/src/gql/operations/*.generated.ts` — update import path (30 files)

**Step 1: Rename the file**

```bash
cd <repo-root>
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

Extract from `client.ts` into `packages/core/src/gql/transport.ts`:
- Type aliases: `GraphqlVariables`, `GraphqlDocument`, `QueryLike` (lines 29-31)
- Interfaces: `GraphqlTransport`, `GraphqlClient` (lines 33-42)
- Functions: `queryToString`, `assertQuery`, `createGraphqlClient` (lines 2143-2172)
- Transport factory: `DEFAULT_GRAPHQL_URL`, `resolveGraphqlUrl`, `createTokenTransport` (lines 2174-2223)
- Type: `TokenClientOptions` (lines 2225-2228)
- **NEW:** `createGraphqlRequestClient` — extracted from `createSdkClients` (lines 1044-1065). This adapts `GraphqlTransport` to `graphql-request`'s `GraphQLClient` interface so domain modules can create SDKs. This is a thin adapter with no domain knowledge.

```ts
import { type DocumentNode, print } from "graphql"
import type { GraphQLClient, RequestDocument, RequestOptions } from "graphql-request"

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

/**
 * Adapts a GraphqlTransport to graphql-request's GraphQLClient interface.
 * Used by domain modules to create codegen SDKs from the transport.
 */
export function createGraphqlRequestClient(transport: GraphqlTransport): GraphQLClient {
  const client: Pick<GraphQLClient, "request"> = {
    request<TData, TVariables extends object = object>(
      documentOrOptions: RequestDocument | RequestOptions<TVariables, TData>,
      ...variablesAndRequestHeaders: unknown[]
    ): Promise<TData> {
      const options =
        typeof documentOrOptions === "object" &&
        documentOrOptions !== null &&
        "document" in documentOrOptions
          ? documentOrOptions
          : {
              document: documentOrOptions,
              variables: variablesAndRequestHeaders[0] as TVariables | undefined,
            }

      const queryText = queryToString(options.document)
      assertQuery(queryText)
      return transport.execute<TData>(queryText, options.variables as GraphqlVariables)
    },
  }

  return client as GraphQLClient
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
  createGraphqlRequestClient,
  createTokenTransport,
  queryToString,
} from "./transport.js"

export type { GraphqlClient, GraphqlTransport, GraphqlVariables, TokenClientOptions }
```

Remove the original definitions of `GraphqlVariables`, `GraphqlDocument`, `QueryLike`, `GraphqlTransport`, `GraphqlClient`, `queryToString`, `assertQuery`, `createGraphqlClient`, `DEFAULT_GRAPHQL_URL`, `resolveGraphqlUrl`, `createTokenTransport`, `TokenClientOptions` from `client.ts`.

Also update `createSdkClients` to use `createGraphqlRequestClient(transport)` instead of its inline client adapter (lines 1044-1065). This makes `createSdkClients` much shorter — just calls to `getSdk(createGraphqlRequestClient(transport))`.

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

Move all `export type *Input` and `export type *Data` definitions from `client.ts` (lines 44-382) into `packages/core/src/gql/types.ts`. These include:
- Codegen re-exports (`RepoViewInput = RepoViewQueryVariables`, etc.)
- Hand-written domain types (`RepoViewData`, `IssueViewData`, `PrViewData`, etc.)
- All `*Input` and `*Data` type definitions

Import the codegen types needed for the re-exports (e.g., `import type { RepoViewQueryVariables } from "./operations/repo-view.generated.js"`). These are `import type` — zero runtime cost.

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

Move all `assert*` functions and helpers from `client.ts` into `packages/core/src/gql/assertions.ts`:
- `assertRepoInput`, `assertIssueInput`, `assertIssueListInput`, `assertIssueCommentsListInput`
- `assertNonEmptyString`, `assertOptionalString`, `assertStringArray`
- `assertIssueCreateInput`, `assertIssueMilestoneSetInput`, `assertIssueCommentCreateInput`
- `assertPrInput`, `assertPrListInput`, `assertPrReviewsListInput`, `assertPrDiffListFilesInput`
- `assertPrCommentsListInput`, `assertReplyToReviewThreadInput`, `assertReviewThreadInput`
- The `asRecord` helper function

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

## Phase 3: Extract domain modules with lazy loading

**Key design decision:** Each domain module's `run*` functions take `GraphqlTransport` (for SDK-based operations) or `GraphqlClient` (for inline GQL operations) as their first argument. Functions that need an SDK call `getSdk(createGraphqlRequestClient(transport))` internally — this is trivially cheap (creates a few closures, no I/O). The `SdkClients` type and `createSdkClients` function are eliminated.

### Task 5: Extract domains/repo.ts

**Files:**
- Create: `packages/core/src/gql/domains/repo.ts`
- Modify: `packages/core/src/gql/client.ts` — remove `runRepoView`

**Step 1: Create domains/repo.ts**

```ts
import { getSdk } from "../operations/repo-view.generated.js"
import type { RepoViewQuery } from "../operations/repo-view.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { createGraphqlRequestClient } from "../transport.js"
import type { RepoViewData, RepoViewInput } from "../types.js"
import { assertRepoInput } from "../assertions.js"

export async function runRepoView(
  transport: GraphqlTransport,
  input: RepoViewInput,
): Promise<RepoViewData> {
  assertRepoInput(input)

  const sdk = getSdk(createGraphqlRequestClient(transport))
  const result: RepoViewQuery = await sdk.RepoView(input)
  if (!result.repository) {
    throw new Error("Repository not found")
  }

  return {
    id: result.repository.id,
    name: result.repository.name,
    nameWithOwner: result.repository.nameWithOwner,
    isPrivate: result.repository.isPrivate,
    stargazerCount: result.repository.stargazerCount,
    forkCount: result.repository.forkCount,
    url: result.repository.url,
    defaultBranch: result.repository.defaultBranchRef?.name ?? null,
  }
}
```

**Step 2: Update client.ts — remove `runRepoView` function. The `createGithubClient` facade still calls it eagerly for now (lazy loading comes in Task 10).**

```ts
import { runRepoView } from "./domains/repo.js"
```

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

Move: `runIssueView`, `runIssueList`, `runIssueCommentsList`.

Each function takes `GraphqlTransport` and calls `getSdk(createGraphqlRequestClient(transport))` internally, using the relevant generated SDK (`getIssueViewSdk`, `getIssueListSdk`, `getIssueCommentsListSdk`).

**Step 2: Update client.ts — remove functions, add import**

**Step 3: Run tests, commit**

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

These functions take `GraphqlClient` (not `GraphqlTransport`) since they use inline GQL queries via `graphqlClient.query()`. `GraphqlClient` is from `transport.ts` and is always eagerly available.

**Step 2: Update client.ts — remove functions, add import**

**Step 3: Run tests, commit**

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

SDK-based functions (`runPrView`, `runPrList`, `runPrReviewsList`, `runPrDiffListFiles`) take `GraphqlTransport` and create their SDK internally.

`runPrMergeStatus` takes `GraphqlClient` (uses inline GQL).

**Step 2: Update client.ts — remove functions, add import**

**Step 3: Run tests, commit**

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

All functions take `GraphqlClient` (inline GQL queries).

**Step 2: Update client.ts — remove functions, add import**

**Step 3: Run tests, commit**

```bash
git commit -m "refactor(gql): extract domains/pr-mutations.ts"
```

---

### Task 10: Create github-client.ts with lazy loading and delete client.ts

This is the core optimization task. The facade uses `await import()` to lazily load domain modules.

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

```ts
import type { GraphqlClient, GraphqlTransport, TokenClientOptions } from "./transport.js"
import { createGraphqlClient, createTokenTransport } from "./transport.js"
import type {
  IssueAssigneesUpdateData,
  IssueAssigneesUpdateInput,
  IssueBlockedByData,
  IssueBlockedByInput,
  IssueCommentCreateData,
  IssueCommentCreateInput,
  IssueCommentsListData,
  IssueCommentsListInput,
  IssueCreateInput,
  IssueLabelsAddData,
  IssueLabelsAddInput,
  IssueLabelsUpdateData,
  IssueLabelsUpdateInput,
  IssueLinkedPrsListData,
  IssueLinkedPrsListInput,
  IssueListData,
  IssueListInput,
  IssueMilestoneSetData,
  IssueMilestoneSetInput,
  IssueMutationData,
  IssueMutationInput,
  IssueParentRemoveData,
  IssueParentRemoveInput,
  IssueParentSetData,
  IssueParentSetInput,
  IssueRelationsGetData,
  IssueRelationsGetInput,
  IssueViewData,
  IssueViewInput,
  PrCommentsListData,
  PrCommentsListInput,
  PrDiffListFilesData,
  PrDiffListFilesInput,
  PrListData,
  PrListInput,
  PrMergeStatusData,
  PrMergeStatusInput,
  PrReviewsListData,
  PrReviewsListInput,
  PrViewData,
  PrViewInput,
  ReplyToReviewThreadInput,
  RepoViewData,
  RepoViewInput,
  ReviewThreadMutationData,
  ReviewThreadMutationInput,
} from "./types.js"

// GithubClient interface — pure types, no runtime cost
export interface GithubClient extends GraphqlClient {
  fetchRepoView(input: RepoViewInput): Promise<RepoViewData>
  fetchIssueCommentsList(input: IssueCommentsListInput): Promise<IssueCommentsListData>
  createIssue(input: IssueCreateInput): Promise<IssueMutationData>
  updateIssue(input: IssueUpdateInput): Promise<IssueMutationData>
  closeIssue(input: IssueMutationInput): Promise<IssueMutationData>
  reopenIssue(input: IssueMutationInput): Promise<IssueMutationData>
  deleteIssue(input: IssueMutationInput): Promise<IssueMutationData>
  updateIssueLabels(input: IssueLabelsUpdateInput): Promise<IssueLabelsUpdateData>
  addIssueLabels(input: IssueLabelsAddInput): Promise<IssueLabelsAddData>
  updateIssueAssignees(input: IssueAssigneesUpdateInput): Promise<IssueAssigneesUpdateData>
  setIssueMilestone(input: IssueMilestoneSetInput): Promise<IssueMilestoneSetData>
  createIssueComment(input: IssueCommentCreateInput): Promise<IssueCommentCreateData>
  fetchIssueLinkedPrs(input: IssueLinkedPrsListInput): Promise<IssueLinkedPrsListData>
  fetchIssueRelations(input: IssueRelationsGetInput): Promise<IssueRelationsGetData>
  setIssueParent(input: IssueParentSetInput): Promise<IssueParentSetData>
  removeIssueParent(input: IssueParentRemoveInput): Promise<IssueParentRemoveData>
  addIssueBlockedBy(input: IssueBlockedByInput): Promise<IssueBlockedByData>
  removeIssueBlockedBy(input: IssueBlockedByInput): Promise<IssueBlockedByData>
  fetchIssueList(input: IssueListInput): Promise<IssueListData>
  fetchIssueView(input: IssueViewInput): Promise<IssueViewData>
  fetchPrList(input: PrListInput): Promise<PrListData>
  fetchPrView(input: PrViewInput): Promise<PrViewData>
  fetchPrCommentsList(input: PrCommentsListInput): Promise<PrCommentsListData>
  fetchPrReviewsList(input: PrReviewsListInput): Promise<PrReviewsListData>
  fetchPrDiffListFiles(input: PrDiffListFilesInput): Promise<PrDiffListFilesData>
  fetchPrMergeStatus(input: PrMergeStatusInput): Promise<PrMergeStatusData>
  replyToReviewThread(input: ReplyToReviewThreadInput): Promise<ReviewThreadMutationData>
  resolveReviewThread(input: ReviewThreadMutationInput): Promise<ReviewThreadMutationData>
  unresolveReviewThread(input: ReviewThreadMutationInput): Promise<ReviewThreadMutationData>
}

/**
 * Create a GithubClient from a token string or options object.
 */
export function createGithubClientFromToken(
  tokenOrOptions: string | TokenClientOptions,
): GithubClient {
  const token = typeof tokenOrOptions === "string" ? tokenOrOptions : tokenOrOptions.token
  const graphqlUrl = typeof tokenOrOptions === "string" ? undefined : tokenOrOptions.graphqlUrl

  if (!token || token.trim().length === 0) {
    throw new Error("GitHub token is required")
  }

  return createGithubClient(createTokenTransport(token, graphqlUrl))
}

/**
 * Create a GithubClient with lazy-loaded domain modules.
 *
 * Each domain module is only imported on first use of any of its operations.
 * Subsequent calls use the cached module. This means importing
 * createGithubClient itself is fast — it only loads transport.ts and types.
 */
export function createGithubClient(transport: GraphqlTransport): GithubClient {
  const graphqlClient = createGraphqlClient(transport)

  // Lazy domain loaders — each domain module is loaded once on first use.
  // We cache the import promise so concurrent first calls share the same load.
  let repo: typeof import("./domains/repo.js") | undefined
  let issueQueries: typeof import("./domains/issue-queries.js") | undefined
  let issueMutations: typeof import("./domains/issue-mutations.js") | undefined
  let prQueries: typeof import("./domains/pr-queries.js") | undefined
  let prMutations: typeof import("./domains/pr-mutations.js") | undefined

  const loadRepo = async () => (repo ??= await import("./domains/repo.js"))
  const loadIssueQueries = async () =>
    (issueQueries ??= await import("./domains/issue-queries.js"))
  const loadIssueMutations = async () =>
    (issueMutations ??= await import("./domains/issue-mutations.js"))
  const loadPrQueries = async () => (prQueries ??= await import("./domains/pr-queries.js"))
  const loadPrMutations = async () =>
    (prMutations ??= await import("./domains/pr-mutations.js"))

  return {
    query: (query, variables) => graphqlClient.query(query, variables),

    // Repo
    fetchRepoView: async (input) => (await loadRepo()).runRepoView(transport, input),

    // Issue queries
    fetchIssueView: async (input) => (await loadIssueQueries()).runIssueView(transport, input),
    fetchIssueList: async (input) => (await loadIssueQueries()).runIssueList(transport, input),
    fetchIssueCommentsList: async (input) =>
      (await loadIssueQueries()).runIssueCommentsList(transport, input),

    // Issue mutations
    createIssue: async (input) =>
      (await loadIssueMutations()).runIssueCreate(graphqlClient, input),
    updateIssue: async (input) =>
      (await loadIssueMutations()).runIssueUpdate(graphqlClient, input),
    closeIssue: async (input) =>
      (await loadIssueMutations()).runIssueClose(graphqlClient, input),
    reopenIssue: async (input) =>
      (await loadIssueMutations()).runIssueReopen(graphqlClient, input),
    deleteIssue: async (input) =>
      (await loadIssueMutations()).runIssueDelete(graphqlClient, input),
    updateIssueLabels: async (input) =>
      (await loadIssueMutations()).runIssueLabelsUpdate(graphqlClient, input),
    addIssueLabels: async (input) =>
      (await loadIssueMutations()).runIssueLabelsAdd(graphqlClient, input),
    updateIssueAssignees: async (input) =>
      (await loadIssueMutations()).runIssueAssigneesUpdate(graphqlClient, input),
    setIssueMilestone: async (input) =>
      (await loadIssueMutations()).runIssueMilestoneSet(graphqlClient, input),
    createIssueComment: async (input) =>
      (await loadIssueMutations()).runIssueCommentCreate(graphqlClient, input),
    fetchIssueLinkedPrs: async (input) =>
      (await loadIssueMutations()).runIssueLinkedPrsList(graphqlClient, input),
    fetchIssueRelations: async (input) =>
      (await loadIssueMutations()).runIssueRelationsGet(graphqlClient, input),
    setIssueParent: async (input) =>
      (await loadIssueMutations()).runIssueParentSet(graphqlClient, input),
    removeIssueParent: async (input) =>
      (await loadIssueMutations()).runIssueParentRemove(graphqlClient, input),
    addIssueBlockedBy: async (input) =>
      (await loadIssueMutations()).runIssueBlockedByAdd(graphqlClient, input),
    removeIssueBlockedBy: async (input) =>
      (await loadIssueMutations()).runIssueBlockedByRemove(graphqlClient, input),

    // PR queries
    fetchPrView: async (input) => (await loadPrQueries()).runPrView(transport, input),
    fetchPrList: async (input) => (await loadPrQueries()).runPrList(transport, input),
    fetchPrReviewsList: async (input) =>
      (await loadPrQueries()).runPrReviewsList(transport, input),
    fetchPrDiffListFiles: async (input) =>
      (await loadPrQueries()).runPrDiffListFiles(transport, input),
    fetchPrMergeStatus: async (input) =>
      (await loadPrQueries()).runPrMergeStatus(graphqlClient, input),

    // PR mutations
    fetchPrCommentsList: async (input) =>
      (await loadPrMutations()).runPrCommentsList(graphqlClient, input),
    replyToReviewThread: async (input) =>
      (await loadPrMutations()).runReplyToReviewThread(graphqlClient, input),
    resolveReviewThread: async (input) =>
      (await loadPrMutations()).runResolveReviewThread(graphqlClient, input),
    unresolveReviewThread: async (input) =>
      (await loadPrMutations()).runUnresolveReviewThread(graphqlClient, input),
  }
}
```

**Why `getSdk(createGraphqlRequestClient(transport))` on every call is fine:**
- `createGraphqlRequestClient` creates a single closure wrapping `transport.execute` — no I/O
- `getSdk` creates an object with a few method closures — no I/O
- Both combined take microseconds vs the milliseconds of the actual GraphQL HTTP call
- No need for SDK caching — the overhead is negligible

**Step 2: Update all imports**

Update every file that currently imports from `../../gql/client.js` (or similar paths):
- Types → `./gql/types.js`
- `GraphqlClient`, `GraphqlTransport` → `./gql/transport.js`
- `GithubClient`, `createGithubClient`, `createGithubClientFromToken` → `./gql/github-client.js`

Key files to update:
- `packages/core/src/index.ts`
- `packages/core/src/cli/commands/run.ts`
- `packages/core/src/core/routing/engine.ts`
- `packages/core/src/core/execution/adapters/graphql-adapter.ts`
- `packages/core/src/core/execution/adapters/graphql-capability-adapter.ts`

**Step 3: Delete `packages/core/src/gql/client.ts`**

**Step 4: Update test files**

Update imports in:
- `test/unit/github-client.test.ts`
- `test/unit/github-client-sdk.test.ts`
- `test/unit/github-graphql-client-ops.test.ts`

**Important test consideration:** Tests create `createGithubClient({ execute } as never)` with mock transports. The lazy loading is transparent — tests call the same methods, which now lazy-load domain modules before delegating. Tests should pass without modification beyond import path changes.

**Step 5: Run full CI**

```bash
pnpm run ci --outputStyle=static
```
Expected: All checks pass.

**Step 6: Commit**

```bash
git commit -m "refactor(gql): replace client.ts with lazy-loading github-client.ts facade"
```

---

## Phase 4: Registry-driven capability dispatch

### Task 11: Create capability handler registry

**Files:**
- Create: `packages/core/src/gql/capability-registry.ts`

**Step 1: Create the registry module**

The registry maps capability IDs to handler functions. Handlers take `(client: GithubClient, params)` and delegate to client methods — the lazy loading happens inside the client, so the registry itself has no domain module imports.

```ts
import type { GithubClient } from "./github-client.js"
import type {
  IssueAssigneesUpdateInput,
  IssueBlockedByInput,
  IssueCommentCreateInput,
  IssueCommentsListInput,
  IssueCreateInput,
  IssueLabelsAddInput,
  IssueLabelsUpdateInput,
  IssueLinkedPrsListInput,
  IssueListInput,
  IssueMilestoneSetInput,
  IssueMutationInput,
  IssueParentRemoveInput,
  IssueParentSetInput,
  IssueRelationsGetInput,
  IssueViewInput,
  PrCommentsListInput,
  PrDiffListFilesInput,
  PrListInput,
  PrMergeStatusInput,
  PrReviewsListInput,
  PrViewInput,
  ReplyToReviewThreadInput,
  RepoViewInput,
  ReviewThreadMutationInput,
} from "./types.js"

export type GraphqlHandler = (
  client: GithubClient,
  params: Record<string, unknown>,
) => Promise<unknown>

function withDefaultFirst<T extends { first?: number }>(params: T): T {
  if (typeof params.first !== "number" || params.first <= 0) {
    return { ...params, first: 30 }
  }
  return params
}

const handlers = new Map<string, GraphqlHandler>([
  // Repo
  ["repo.view", (c, p) => c.fetchRepoView(p as RepoViewInput)],

  // Issue queries
  ["issue.view", (c, p) => c.fetchIssueView(p as IssueViewInput)],
  ["issue.list", (c, p) => c.fetchIssueList(withDefaultFirst(p) as IssueListInput)],
  ["issue.comments.list", (c, p) =>
    c.fetchIssueCommentsList(withDefaultFirst(p) as IssueCommentsListInput)],

  // Issue mutations
  ["issue.create", (c, p) => c.createIssue(p as IssueCreateInput)],
  ["issue.update", (c, p) => c.updateIssue(p as IssueUpdateInput)],
  ["issue.close", (c, p) => c.closeIssue(p as IssueMutationInput)],
  ["issue.reopen", (c, p) => c.reopenIssue(p as IssueMutationInput)],
  ["issue.delete", (c, p) => c.deleteIssue(p as IssueMutationInput)],
  ["issue.labels.update", (c, p) => c.updateIssueLabels(p as IssueLabelsUpdateInput)],
  ["issue.labels.add", (c, p) => c.addIssueLabels(p as IssueLabelsAddInput)],
  ["issue.assignees.update", (c, p) =>
    c.updateIssueAssignees(p as IssueAssigneesUpdateInput)],
  ["issue.milestone.set", (c, p) => c.setIssueMilestone(p as IssueMilestoneSetInput)],
  ["issue.comment.create", (c, p) => c.createIssueComment(p as IssueCommentCreateInput)],
  ["issue.linked-prs.list", (c, p) =>
    c.fetchIssueLinkedPrs(p as IssueLinkedPrsListInput)],
  ["issue.relations.get", (c, p) => c.fetchIssueRelations(p as IssueRelationsGetInput)],
  ["issue.parent.set", (c, p) => c.setIssueParent(p as IssueParentSetInput)],
  ["issue.parent.remove", (c, p) => c.removeIssueParent(p as IssueParentRemoveInput)],
  ["issue.blocked-by.add", (c, p) => c.addIssueBlockedBy(p as IssueBlockedByInput)],
  ["issue.blocked-by.remove", (c, p) => c.removeIssueBlockedBy(p as IssueBlockedByInput)],

  // PR queries
  ["pr.view", (c, p) => c.fetchPrView(p as PrViewInput)],
  ["pr.list", (c, p) => c.fetchPrList(withDefaultFirst(p) as PrListInput)],
  ["pr.reviews.list", (c, p) =>
    c.fetchPrReviewsList(withDefaultFirst(p) as PrReviewsListInput)],
  ["pr.diff.list-files", (c, p) =>
    c.fetchPrDiffListFiles(withDefaultFirst(p) as PrDiffListFilesInput)],
  ["pr.merge-status", (c, p) => c.fetchPrMergeStatus(p as PrMergeStatusInput)],

  // PR mutations
  ["pr.comments.list", (c, p) =>
    c.fetchPrCommentsList(withDefaultFirst(p) as PrCommentsListInput)],
  ["pr.review-thread.reply", (c, p) =>
    c.replyToReviewThread(p as ReplyToReviewThreadInput)],
  ["pr.review-thread.resolve", (c, p) =>
    c.resolveReviewThread(p as ReviewThreadMutationInput)],
  ["pr.review-thread.unresolve", (c, p) =>
    c.unresolveReviewThread(p as ReviewThreadMutationInput)],
])

export function getGraphqlHandler(capabilityId: string): GraphqlHandler | undefined {
  return handlers.get(capabilityId)
}

export function listGraphqlCapabilities(): string[] {
  return [...handlers.keys()]
}
```

**Key insight:** The handlers only call `GithubClient` methods — they don't import domain modules. The lazy loading happens inside `GithubClient.fetchXxx()`. This means `capability-registry.ts` imports only types (zero runtime cost) plus the `GithubClient` type from `github-client.ts`.

**Step 2: Commit**

```bash
git add packages/core/src/gql/capability-registry.ts
git commit -m "refactor(gql): add capability handler registry"
```

---

### Task 12: Replace if-chain in graphql-capability-adapter.ts

**Files:**
- Modify: `packages/core/src/core/execution/adapters/graphql-capability-adapter.ts`

**Step 1: Rewrite runGraphqlCapability**

Replace the entire if-chain with registry lookup:

```ts
import { getGraphqlHandler } from "../../../gql/capability-registry.js"
import type { GithubClient } from "../../../gql/github-client.js"
import type { ResultEnvelope } from "../../contracts/envelope.js"
import { errorCodes } from "../../errors/codes.js"
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

**Step 2: Remove the `GraphqlCapabilityId` union type**

The registry accepts any string and returns `undefined` for unknown capabilities. The `GraphqlCapabilityId` type can be removed. If you need it for type safety at call sites, derive it from the registry:

```ts
export type GraphqlCapabilityId = ReturnType<typeof listGraphqlCapabilities>[number]
```

Or keep it as a manually maintained union — your call.

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

### Task 13: Create missing .graphql files

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

### Task 14: Run codegen and verify

```bash
GITHUB_TOKEN=$GITHUB_TOKEN pnpm --filter @ghx-dev/core exec graphql-codegen
pnpm run ghx:gql:check
```

### Task 15: Switch domain modules to use generated SDKs

For each domain module, replace `graphqlClient.query<unknown>(INLINE_STRING, vars)` calls with the generated SDK method calls (same pattern as `runRepoView` currently uses).

After this, the domain modules that used `GraphqlClient` for inline GQL now switch to taking `GraphqlTransport` and using SDKs — making the lazy loading more effective (no need to pass both `transport` and `graphqlClient`).

### Task 16: Remove all inline GQL strings from domain modules

Delete the `const *_QUERY = \`...\`` and `const *_MUTATION = \`...\`` template literals.

### Task 17: Run full CI, commit

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
  transport.ts                  # GraphqlTransport, GraphqlClient, createGraphqlClient,
                                # createGraphqlRequestClient, token transport (~100 lines)
  types.ts                      # All *Input/*Data types (pure types, zero runtime)
  assertions.ts                 # All assert* validation helpers, asRecord
  github-client.ts              # GithubClient interface + lazy-loading factories (~120 lines)
  capability-registry.ts        # Handler map delegating to GithubClient methods (no domain imports)
  generated/
    common-types.generated.ts   # Renamed from common-types.ts
  domains/                      # Each loaded on-demand via await import()
    repo.ts                     # runRepoView
    issue-queries.ts            # runIssueView, runIssueList, runIssueCommentsList
    issue-mutations.ts          # All issue mutation runners
    pr-queries.ts               # runPrView, runPrList, runPrReviewsList, runPrDiffListFiles, runPrMergeStatus
    pr-mutations.ts             # runPrCommentsList, runReplyToReviewThread, resolve/unresolve
  operations/                   # Unchanged — .graphql files + .generated.ts codegen output
    fragments/
```

**Deleted:** `packages/core/src/gql/client.ts`

## What this optimizes

| Metric | Before | After |
|--------|--------|-------|
| Code evaluated on `import { createGithubClient }` | ~2,284 lines + 8 SDK modules | ~220 lines (transport + github-client + types) |
| Code loaded per operation | All 30 operations | Only the domain module needed |
| Adding a new capability | Edit 350-line if-chain + update Pick<> types | Add one line to registry map |
| File organization | Single 2,284-line file | 5 domain modules + 4 infrastructure files |
