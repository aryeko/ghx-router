# PR Review Fixes — Atomic Chaining Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address 8 issues identified in the CodeRabbit + Claude review of PR #59 (feat/atomic-chaining).

**Architecture:** Four independent fix tracks that can be executed in parallel — chain.ts robustness, engine.ts correctness, test infrastructure repair, and documentation. All work is confined to `packages/core/` inside the `feat-atomic-chaining` worktree at `.worktrees/feat-atomic-chaining/`.

**Tech Stack:** TypeScript strict ESM, Vitest, Biome (formatter), Node >=22.

---

## Worktree Context

All file paths are relative to `.worktrees/feat-atomic-chaining/`. Always run commands from that directory:

```bash
cd /Users/aryekogan/repos/ghx/.worktrees/feat-atomic-chaining
```

Run tests with:
```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts
pnpm --filter @ghx-dev/core exec vitest run test/unit/chain.test.ts
pnpm --filter @ghx-dev/core exec vitest run test/unit/document-registry.test.ts
pnpm run typecheck
pnpm run lint
```

Format (auto-fix) with:
```bash
pnpm run format
```

---

## Track A — `chain.ts` Robustness (CR-1 + CR-2)

**Files:**
- Modify: `packages/core/src/cli/commands/chain.ts`
- Test: `packages/core/test/unit/chain.test.ts` (create if not exists)

### Task A1: Add fetch timeout and safe JSON parsing

**Context:** `executeGraphqlRequest` in `chain.ts` calls `response.json()` without a try-catch. If GitHub returns an HTML error page (e.g. 503 gateway timeout), `response.json()` throws a `SyntaxError` with a confusing internal stack trace. Also, there is no network timeout — the CLI can hang indefinitely.

**Step 1: Write failing tests**

Create (or add to) `packages/core/test/unit/chain.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest"

describe("executeGraphqlRequest (via chainCommand)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    process.env.GITHUB_TOKEN = "test-token"
  })

  it("throws a user-friendly error when response is non-JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
    }))
    const { chainCommand } = await import("@core/cli/commands/chain.js")
    // chainCommand must not throw — it must return exit code 1
    const code = await chainCommand(["--steps", "[{\"task\":\"issue.create\",\"input\":{}}]"])
    expect(code).toBe(1)
  })

  it("aborts request after 30s timeout", async () => {
    // Simulate a fetch that never resolves
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, opts) => {
      // Verify the signal is attached
      expect(opts?.signal).toBeDefined()
      return new Promise(() => {}) // never resolves
    }))
    // Just verify signal is passed — we can't wait 30s in tests
    const { chainCommand } = await import("@core/cli/commands/chain.js")
    // Fire and forget — just check fetch was called with a signal
    chainCommand(["--steps", "[{\"task\":\"issue.create\",\"input\":{}}]"])
    await new Promise((r) => setTimeout(r, 0))
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/aryekogan/repos/ghx/.worktrees/feat-atomic-chaining
pnpm --filter @ghx-dev/core exec vitest run test/unit/chain.test.ts
```

Expected: FAIL (non-JSON test likely throws instead of returning 1; signal test fails because no signal is passed).

**Step 3: Implement fix in `chain.ts`**

In `executeGraphqlRequest`, make two changes:

1. Add `signal: AbortSignal.timeout(30_000)` to the `fetch` call options.
2. Wrap `response.json()` in a try-catch:

```ts
async function executeGraphqlRequest<TData>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "user-agent": "ghx",
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
    signal: AbortSignal.timeout(30_000),
  })

  let payload: { data?: TData; errors?: Array<{ message?: string }>; message?: string }
  try {
    payload = (await response.json()) as typeof payload
  } catch {
    throw new Error(
      `GitHub GraphQL returned non-JSON response (status ${response.status})`,
    )
  }

  // ... rest unchanged
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/chain.test.ts
```

Expected: PASS

**Step 5: Format and typecheck**

```bash
pnpm run format
pnpm run typecheck
```

**Step 6: Commit**

```bash
git add packages/core/src/cli/commands/chain.ts packages/core/test/unit/chain.test.ts
git commit -m "fix(chain): safe json parse + 30s abort timeout on graphql fetch"
```

---

### Task A2: Wrap sync throws inside chainCommand to produce clean exit code 1

**Context:** `chainCommand` calls `parseChainFlags`, `parseJsonSteps`, `resolveGithubToken` synchronously. These throw plain `Error`s. Inside an `async` function this rejects the returned promise. `index.ts` catches rejections via `.then(_, err => process.exit(1))`, but the pattern doesn't give the user a clean error path vs unexpected failures. Wrap with try-catch to explicitly return code 1 with stderr output.

**Step 1: Write failing test**

Add to `packages/core/test/unit/chain.test.ts`:

```ts
it("returns exit code 1 and writes to stderr when token is missing", async () => {
  delete process.env.GITHUB_TOKEN
  delete process.env.GH_TOKEN
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
  const { chainCommand } = await import("@core/cli/commands/chain.js")
  const code = await chainCommand(["--steps", "[{\"task\":\"t\",\"input\":{}}]"])
  expect(code).toBe(1)
  expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("GITHUB_TOKEN"))
  stderrSpy.mockRestore()
})

it("returns exit code 1 and writes to stderr when steps JSON is invalid", async () => {
  process.env.GITHUB_TOKEN = "tok"
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
  const { chainCommand } = await import("@core/cli/commands/chain.js")
  const code = await chainCommand(["--steps", "not-json"])
  expect(code).toBe(1)
  expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid JSON"))
  stderrSpy.mockRestore()
})
```

**Step 2: Run tests to verify they fail**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/chain.test.ts -t "returns exit code 1"
```

Expected: FAIL (currently throws instead of returning 1).

**Step 3: Wrap `chainCommand` body in try-catch**

In `chain.ts`, change `chainCommand` to:

```ts
export async function chainCommand(argv: string[] = []): Promise<number> {
  if (argv.length === 0) {
    process.stdout.write(
      "Usage: ghx chain --steps '<json-array>' | --steps - [--check-gh-preflight]\n",
    )
    return 1
  }

  try {
    const { stepsSource, skipGhPreflight } = parseChainFlags(argv)
    const steps =
      stepsSource === "stdin"
        ? parseJsonSteps(await readStdin())
        : parseJsonSteps(stepsSource.raw)
    const githubToken = resolveGithubToken()

    const githubClient = createGithubClient({
      async execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
        return executeGraphqlRequest<TData>(githubToken, query, variables)
      },
    })

    const result = await executeTasks(steps, {
      githubClient,
      githubToken,
      skipGhPreflight,
    })

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return result.status === "success" || result.status === "partial" ? 0 : 1
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`${message}\n`)
    return 1
  }
}
```

**Step 4: Run tests**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/chain.test.ts
```

Expected: PASS

**Step 5: Format, typecheck, commit**

```bash
pnpm run format
pnpm run typecheck
git add packages/core/src/cli/commands/chain.ts packages/core/test/unit/chain.test.ts
git commit -m "fix(chain): catch sync throws inside chainCommand, return exit 1 with stderr"
```

---

## Track B — `engine.ts` Correctness (CR-3 + CL-4)

**Files:**
- Modify: `packages/core/src/core/routing/engine.ts`
- Test: `packages/core/test/unit/engine.test.ts`

### Task B1: Fix preflight error mis-attribution on duplicate task names (CR-3)

**Context:** `executeTasks` builds `preflightErrors: ChainStepResult[]` by task name string. Then it maps results back with:

```ts
preflightErrors.find((e) => e.task === req.task)
```

If a chain has two steps with the same capability (e.g. `issue.close` twice) and only the second fails, the `.find()` matches the task name and returns the error for both, mis-attributing it to the first step too.

**Step 1: Write failing test**

Add to `packages/core/test/unit/engine.test.ts` inside `describe("executeTasks", ...)`:

```ts
it("pre-flight correctly attributes errors when same capability appears twice", async () => {
  // First call returns a valid card, second call returns undefined (unknown task)
  getOperationCardMock
    .mockReturnValueOnce(undefined) // step 0 fails: unknown task
    .mockReturnValueOnce({ ...baseCard, graphql: { operationName: "IssueClose", documentPath: "x" } }) // step 1 ok

  const { executeTasks } = await import("@core/core/routing/engine.js")

  const result = await executeTasks(
    [
      { task: "issue.close", input: { issueId: "I1" } },
      { task: "issue.close", input: { issueId: "I2" } },
    ],
    { githubClient: createGithubClient() },
  )

  expect(result.status).toBe("failed")
  // Only step 0 should have a specific error; step 1 gets "pre-flight failed" fallback
  expect(result.results[0]?.ok).toBe(false)
  expect(result.results[0]?.error?.message).toContain("Invalid task")
  expect(result.results[1]?.ok).toBe(false)
  // step 1 should get the generic fallback, NOT the same error as step 0
  expect(result.results[1]?.error?.message).not.toContain("Invalid task")
})
```

**Step 2: Run to confirm failure**

```bash
cd /Users/aryekogan/repos/ghx/.worktrees/feat-atomic-chaining
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts -t "correctly attributes errors"
```

Expected: FAIL (both get the same error currently).

**Step 3: Fix the error attribution in `engine.ts`**

In `executeTasks`, change the `preflightErrors` array to track by step index. Locate the pre-flight loop (around line 253) and modify:

```ts
// Change type of preflightErrors to include stepIndex
const preflightErrors: Array<ChainStepResult & { stepIndex: number }> = []

// In the loop (add index):
for (let i = 0; i < requests.length; i += 1) {
  const req = requests[i]
  if (req === undefined) continue
  try {
    const card = getOperationCard(req.task)
    if (!card) {
      throw new Error(`Invalid task: ${req.task}`)
    }
    // ... validation unchanged ...
    cards.push(card)
  } catch (err) {
    preflightErrors.push({
      stepIndex: i,
      task: req.task,
      ok: false,
      error: {
        code: mapErrorToCode(err),
        message: err instanceof Error ? err.message : String(err),
        retryable: false,
      },
    })
  }
}

// Change the result mapping:
results: requests.map(
  (req, i) =>
    preflightErrors.find((e) => e.stepIndex === i) ?? {
      task: req.task,
      ok: false,
      error: { code: errorCodes.Unknown, message: "pre-flight failed", retryable: false },
    },
),
```

Note: the `for...of` loop over `requests` must become a `for (let i = 0; ...)` loop. The `cards.push` logic needs adjustment too — currently `cards` is built in the same loop but only when preflight succeeds. Keep that: only push to `cards` in the non-error branch.

**Step 4: Run test**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts
```

Expected: all engine tests PASS.

**Step 5: Format + typecheck + commit**

```bash
pnpm run format
pnpm run typecheck
git add packages/core/src/core/routing/engine.ts packages/core/test/unit/engine.test.ts
git commit -m "fix(engine): track preflight errors by step index, not task name"
```

---

### Task B2: Validate lookup vars exist in input before Phase 1 (CL-4)

**Context:** Phase 1 resolution (lookup) reads vars from `req.input` via `lookup.vars` mapping. If a required lookup var is missing from input (e.g. because the YAML card was misconfigured), GitHub receives `undefined` as a variable and returns a confusing error. Add an explicit check.

**Step 1: Write failing test**

Add to `packages/core/test/unit/engine.test.ts`:

```ts
it("pre-flight rejects chain when resolution lookup var is missing from input", async () => {
  const cardWithResolution = {
    ...baseCard,
    graphql: {
      operationName: "IssueLabelsSet",
      documentPath: "src/gql/operations/issue-labels-set.graphql",
      resolution: {
        lookup: {
          operationName: "IssueLabelsLookup",
          documentPath: "src/gql/operations/issue-labels-lookup.graphql",
          // requires "owner" and "name" from input
          vars: { owner: "owner", name: "name", repoName: "name" },
        },
        inject: [],
      },
    },
  }
  getOperationCardMock.mockReturnValue(cardWithResolution)

  const { executeTasks } = await import("@core/core/routing/engine.js")

  const result = await executeTasks(
    // input is missing "name"
    [{ task: "issue.labels.set", input: { owner: "acme" } }],
    { githubClient: createGithubClient() },
  )

  expect(result.status).toBe("failed")
  expect(result.results[0]?.ok).toBe(false)
  expect(result.results[0]?.error?.message).toContain("name")
})
```

**Step 2: Run to confirm failure**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts -t "resolution lookup var is missing"
```

Expected: FAIL (currently no such check).

**Step 3: Add lookup var validation in `engine.ts`**

In the pre-flight loop, after `cards.push(card)` succeeds (the card is valid), add:

```ts
// Validate resolution lookup vars exist in input
if (card.graphql?.resolution) {
  const { lookup } = card.graphql.resolution
  for (const [, inputField] of Object.entries(lookup.vars)) {
    if (req.input[inputField] === undefined) {
      throw new Error(
        `Resolution pre-flight failed for '${req.task}': lookup var '${inputField}' is missing from input`,
      )
    }
  }
}
```

Place this check INSIDE the try block, BEFORE `cards.push(card)` (so the card isn't pushed if vars are missing).

**Step 4: Run all engine tests**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts
```

Expected: PASS

**Step 5: Format + typecheck + commit**

```bash
pnpm run format
pnpm run typecheck
git add packages/core/src/core/routing/engine.ts packages/core/test/unit/engine.test.ts
git commit -m "fix(engine): validate resolution lookup vars exist in input at pre-flight"
```

---

## Track C — Test Infrastructure (CR-5 + CL-7 + CL-6)

**Files:**
- Modify: `packages/core/test/unit/engine.test.ts`
- Create: `packages/core/test/unit/document-registry.test.ts`

### Task C1: Fix ineffective `vi.doMock` calls (CR-5)

**Context:** Two tests in `engine.test.ts` ("2-item pure-mutation chain" and "status is partial when one step fails") call `vi.doMock` for `@core/gql/document-registry.js`, `@core/gql/batch.js`, and `@core/gql/resolve.js`. These calls are ineffective because those modules are already statically imported by `engine.ts` at the time `engine.ts` was first imported. The mocks never take effect — the tests exercise the real implementations.

**The correct pattern** (already used in `safe-runner.test.ts`):
1. `vi.resetModules()` — clears module cache
2. `vi.doMock(...)` — registers factory for next import
3. `await import(...)` — re-imports with fresh mocks

However: `engine.test.ts` uses `vi.mock()` at module level for `@core/core/execute/execute.js` and `@core/core/registry/index.js`. These module-level mocks ARE effective because Vitest hoists them. The `vi.doMock` calls in individual tests are the problem.

**Step 1: Understand what the two broken tests actually need**

The "2-item pure-mutation chain" test wants to:
- Control what `getMutationDocument` returns (a raw GQL string)
- Control what `buildBatchMutation` returns (a composed document + variables)
- Assert that `query` is called with the composed document

The "status is partial" test wants the same but simulates the `query` call rejecting.

**Step 2: Rewrite the two broken tests using `vi.resetModules` + dynamic import**

Replace the two tests (starting at "2-item pure-mutation chain") with:

```ts
describe("executeTasks — batch mutation integration", () => {
  it("2-item pure-mutation chain returns success after batch mutation", async () => {
    vi.resetModules()

    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    const getMutationDocumentMock = vi.fn().mockReturnValue(
      `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
    )
    const buildBatchMutationMock = vi.fn().mockReturnValue({
      document: `mutation BatchComposite { step0: createIssue { issue { id } } step1: createIssue { issue { id } } }`,
      variables: { step0_repositoryId: "R1", step0_title: "Issue 1", step1_repositoryId: "R2", step1_title: "Issue 2" },
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: getMutationDocumentMock,
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: buildBatchMutationMock,
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const queryMock = vi.fn().mockResolvedValue({
      step0: { issue: { id: "I1" } },
      step1: { issue: { id: "I2" } },
    })

    const result = await executeTasks(
      [
        { task: "issue.create", input: { repositoryId: "R1", title: "Issue 1" } },
        { task: "issue.create", input: { repositoryId: "R2", title: "Issue 2" } },
      ],
      { githubClient: createGithubClient({ query: queryMock }) },
    )

    expect(getMutationDocumentMock).toHaveBeenCalledWith("IssueCreate")
    expect(buildBatchMutationMock).toHaveBeenCalled()
    expect(result.status).toBe("success")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({ task: "issue.create", ok: true })
    expect(result.results[1]).toMatchObject({ task: "issue.create", ok: true })
  })

  it("status is failed when batch mutation query rejects", async () => {
    vi.resetModules()

    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi.fn().mockReturnValue(
        `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
      ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation BatchComposite { step0: createIssue { issue { id } } }`,
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.create", input: { repositoryId: "R1", title: "Issue 1" } },
        { task: "issue.create", input: { repositoryId: "R2", title: "Issue 2" } },
      ],
      {
        githubClient: createGithubClient({
          query: vi.fn().mockRejectedValue(new Error("network error")),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[1]?.ok).toBe(false)
  })
})
```

**Step 3: Run tests**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts
```

Expected: PASS, and now `getMutationDocumentMock` and `buildBatchMutationMock` are actually called (verifiable via `.toHaveBeenCalledWith`).

**Step 4: Format + typecheck + commit**

```bash
pnpm run format
pnpm run typecheck
git add packages/core/test/unit/engine.test.ts
git commit -m "fix(test): replace ineffective vi.doMock with resetModules+dynamic import pattern"
```

---

### Task C2: Add mixed-resolution chain test (CL-7)

**Context:** No test covers a chain where some steps need Phase 1 resolution (lookup) and some don't. This is the most common real-world case (e.g., step 0 is `issue.close` with no resolution, step 1 is `issue.labels.set` needing label ID lookup).

**Step 1: Write the test**

Add a new `describe` block in `engine.test.ts`:

```ts
describe("executeTasks — mixed resolution chain", () => {
  it("correctly handles a chain where only one step requires Phase 1 resolution", async () => {
    vi.resetModules()

    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardNoResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "src/gql/operations/issue-labels-set.graphql",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "src/gql/operations/issue-labels-lookup.graphql",
            vars: { owner: "owner", name: "name" },
          },
          inject: [
            { target: "labelIds", source: "map_array", from_input: "labels",
              nodes_path: "repository.labels.nodes", match_field: "name", extract_field: "id" },
          ],
        },
      },
    }

    getOperationCardMock
      .mockReturnValueOnce(cardNoResolution)  // step 0
      .mockReturnValueOnce(cardWithResolution) // step 1

    const lookupDocMock = vi.fn().mockReturnValue(
      `query IssueLabelsLookup($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { labels(first: 100) { nodes { id name } } } }`,
    )
    const mutDocMock = vi.fn().mockImplementation((op: string) => {
      if (op === "IssueClose") return `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`
      return `mutation IssueLabelsSet($issueId: ID!, $labelIds: [ID!]!) { updateIssue(input: {id: $issueId, labelIds: $labelIds}) { issue { id } } }`
    })
    const buildBatchQueryMock = vi.fn().mockReturnValue({
      document: `query BatchQuery { step1: repository { labels { nodes { id name } } } }`,
      variables: { step1_owner: "acme", step1_name: "repo" },
    })
    const buildBatchMutMock = vi.fn().mockReturnValue({
      document: `mutation BatchMut { step0: closeIssue { issue { id } } step1: updateIssue { issue { id } } }`,
      variables: {},
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: lookupDocMock,
      getMutationDocument: mutDocMock,
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: buildBatchQueryMock,
      buildBatchMutation: buildBatchMutMock,
    }))

    // Phase 1 returns label nodes; Phase 2 returns mutation result
    const queryMock = vi.fn()
      .mockResolvedValueOnce({
        // Phase 1 result: step1 lookup
        step1: { repository: { labels: { nodes: [{ id: "L1", name: "bug" }] } } },
      })
      .mockResolvedValueOnce({
        // Phase 2 result: mutations
        step0: { closeIssue: { issue: { id: "I1" } } },
        step1: { updateIssue: { issue: { id: "I2" } } },
      })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.labels.set", input: { issueId: "I2", owner: "acme", name: "repo", labels: ["bug"] } },
      ],
      { githubClient: createGithubClient({ query: queryMock }) },
    )

    // Phase 1 should have been called (lookup for step 1)
    expect(buildBatchQueryMock).toHaveBeenCalled()
    // Phase 2 should have been called
    expect(buildBatchMutMock).toHaveBeenCalled()
    expect(result.status).toBe("success")
    expect(result.results[0]).toMatchObject({ task: "issue.close", ok: true })
    expect(result.results[1]).toMatchObject({ task: "issue.labels.set", ok: true })
  })
})
```

**Step 2: Run test**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts -t "mixed resolution"
```

Investigate failures carefully — if Phase 1 or Phase 2 is wired incorrectly in the engine, this test will expose it.

**Step 3: Format + typecheck + commit**

```bash
pnpm run format
pnpm run typecheck
git add packages/core/test/unit/engine.test.ts
git commit -m "test(engine): add mixed-resolution chain coverage (step with + without Phase 1)"
```

---

### Task C3: Add document registry validation test (CL-6)

**Context:** `document-registry.ts` manually maps operation names to generated GraphQL documents. If a generated file is renamed or removed, the registry silently breaks. A simple test asserting all registered operations resolve prevents regressions.

**Step 1: Create test file**

Create `packages/core/test/unit/document-registry.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getLookupDocument, getMutationDocument } from "@core/gql/document-registry.js"

const EXPECTED_LOOKUP_OPERATIONS = [
  "IssueLabelsLookup",
  "IssueAssigneesLookup",
  "IssueMilestoneLookup",
  "IssueParentLookup",
  "IssueCreateRepositoryId",
  "PrNodeId",
]

const EXPECTED_MUTATION_OPERATIONS = [
  "IssueAssigneesUpdate",
  "IssueBlockedByAdd",
  "IssueBlockedByRemove",
  "IssueClose",
  "IssueCommentCreate",
  "IssueCreate",
  "IssueDelete",
  "IssueLabelsAdd",
  "IssueLabelsUpdate",
  "IssueMilestoneSet",
  "IssueParentRemove",
  "IssueParentSet",
  "IssueReopen",
  "IssueUpdate",
  "PrCommentReply",
  "PrCommentResolve",
  "PrCommentUnresolve",
  "PrReviewSubmit",
]

describe("document-registry", () => {
  it.each(EXPECTED_LOOKUP_OPERATIONS)(
    "getLookupDocument resolves '%s' to a non-empty string",
    (op) => {
      const doc = getLookupDocument(op)
      expect(typeof doc).toBe("string")
      expect(doc.length).toBeGreaterThan(0)
    },
  )

  it.each(EXPECTED_MUTATION_OPERATIONS)(
    "getMutationDocument resolves '%s' to a non-empty string",
    (op) => {
      const doc = getMutationDocument(op)
      expect(typeof doc).toBe("string")
      expect(doc.length).toBeGreaterThan(0)
    },
  )

  it("getLookupDocument throws for unknown operation", () => {
    expect(() => getLookupDocument("UnknownOp")).toThrow(/UnknownOp/)
  })

  it("getMutationDocument throws for unknown operation", () => {
    expect(() => getMutationDocument("UnknownOp")).toThrow(/UnknownOp/)
  })
})
```

**Step 2: Run tests**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/document-registry.test.ts
```

Expected: PASS (all operations should resolve if registry is intact).

**Step 3: Format + typecheck + commit**

```bash
pnpm run format
pnpm run typecheck
git add packages/core/test/unit/document-registry.test.ts
git commit -m "test(registry): validate all registered lookup and mutation operations resolve"
```

---

## Track D — Documentation (CL-1)

**Files:**
- Modify: `packages/core/src/core/registry/types.ts`
- Modify: `docs/architecture/operation-cards.md`

### Task D1: Document `input` inject source type

**Context:** `InputPassthroughInject` (`source: "input"`) is implemented in `types.ts` and `resolve.ts`, used in `issue.labels.add.yaml`, but not documented anywhere card authors would look. Future card authors will create unnecessary Phase 1 lookups instead of using this simpler form.

**Step 1: Add JSDoc to `types.ts`**

In `packages/core/src/core/registry/types.ts`, add comments to each inject interface:

```ts
/**
 * Injects a scalar value extracted from a Phase 1 lookup result.
 * `path` is a dot-notation path into the lookup response data.
 * Example: `{ source: "scalar", target: "pullRequestId", path: "repository.pullRequest.id" }`
 */
export interface ScalarInject {
  target: string
  source: "scalar"
  path: string
}

/**
 * Resolves a list of human-readable names to their corresponding node IDs using a Phase 1 lookup.
 * Uses case-insensitive matching on `match_field`.
 * Example: resolves label names → label IDs via `repository.labels.nodes`.
 */
export interface MapArrayInject {
  target: string
  source: "map_array"
  from_input: string
  nodes_path: string
  match_field: string
  extract_field: string
}

/**
 * Passes a value directly from the step's `input` into the mutation variable — no Phase 1 lookup needed.
 * Use when the caller already has the node ID (e.g. `issueId` is passed directly by the agent).
 * Example: `{ source: "input", target: "labelableId", from_input: "issueId" }`
 */
export interface InputPassthroughInject {
  target: string
  source: "input"
  from_input: string
}
```

**Step 2: Update architecture doc**

Open `docs/architecture/operation-cards.md`. Find the section describing the `inject` array in resolution blocks. Add documentation for the three `source` types. Look for a YAML example block showing `inject:` — expand it to include all three types:

```yaml
# inject source types:

# 1. scalar — extract a single value from Phase 1 lookup result using dot-path
inject:
  - target: pullRequestId
    source: scalar
    path: repository.pullRequest.id

# 2. map_array — resolve a list of names → IDs via Phase 1 lookup nodes
inject:
  - target: labelIds
    source: map_array
    from_input: labels
    nodes_path: repository.labels.nodes
    match_field: name
    extract_field: id

# 3. input — pass value directly from step input, no Phase 1 lookup needed
inject:
  - target: labelableId
    source: input
    from_input: issueId
```

If the doc doesn't have a resolution section, add one under the `graphql:` block documentation.

**Step 3: Typecheck (no new code, just comments)**

```bash
pnpm run typecheck
```

**Step 4: Format + commit**

```bash
pnpm run format
git add packages/core/src/core/registry/types.ts docs/architecture/operation-cards.md
git commit -m "docs(types): document all three InjectSpec source types with JSDoc and arch doc examples"
```

---

## Final Integration

After all four tracks complete, run the full CI suite from the worktree:

```bash
cd /Users/aryekogan/repos/ghx/.worktrees/feat-atomic-chaining
pnpm run ci --outputStyle=static
```

Expected: all checks pass. If typecheck fails, fix types before declaring done.
