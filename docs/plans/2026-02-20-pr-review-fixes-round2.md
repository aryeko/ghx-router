# PR #59 Review Fixes — Round 2

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all actionable comments from the second round of CodeRabbit review on PR #59 (feat/atomic-chaining).

**Architecture:** Seven independent fixes across code correctness, type hygiene, import style, and doc accuracy. No new features — each change is a targeted, minimal edit. The one large suggestion (partial-error propagation) is explicitly deferred.

**Tech Stack:** TypeScript strict + ESM, Vitest, Biome formatter, pnpm workspaces in `.worktrees/feat-atomic-chaining/`.

---

## Skipped / Deferred

| Comment | Decision |
|---------|----------|
| `docs/plans` (39-41): change `.set` → `.update` in followup plan | **Skip** — reviewer direction is wrong; actual card files are named `.set` |
| `docs/plans` (52-68): partial-error propagation via raw HTTP response | **Defer** — requires breaking change to `GithubClient` contract; tracked in follow-up |
| `docs/capabilities/README.md` (53-54): rename `blocked_by` → `blocking` | **Skip** — YAML card files already named `issue.relations.blocked_by.*`; renaming would break existing consumers |

---

## Task 1: Add `queryMock.toHaveBeenCalledTimes(2)` assertion

**Files:**
- Modify: `packages/core/test/unit/engine.test.ts:622-627`

**Step 1: Open the mixed-resolution chain test** (line 512 of engine.test.ts). The `queryMock` variable is defined at line 599. The test currently only checks `buildBatchQueryMock` and `buildBatchMutationMock` were called, but never asserts the underlying HTTP client was actually invoked twice (once per phase).

**Step 2: Add the assertion** immediately after line 623 (`expect(buildBatchMutationMock).toHaveBeenCalled()`):

```typescript
    expect(buildBatchQueryMock).toHaveBeenCalled()
    expect(buildBatchMutationMock).toHaveBeenCalled()
    expect(queryMock).toHaveBeenCalledTimes(2)   // ← add this line
    expect(result.status).toBe("success")
```

**Step 3: Run the test**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts -t "mixed resolution"
```
Expected: `1 test passed`

**Step 4: Commit**

```bash
git add packages/core/test/unit/engine.test.ts
git commit -m "test(engine): assert queryMock called twice in mixed-resolution chain test"
```

---

## Task 2: Extract `LookupSpec` named interface from `types.ts`

**Files:**
- Modify: `packages/core/src/core/registry/types.ts:78-89`

The docs diagram (`operation-cards.md`) references `LookupSpec` as a named type, but the TypeScript source inlines the lookup shape inside `ResolutionConfig`. Extracting it makes the two consistent and enables reuse in tests.

**Step 1: Add the named interface** just before `ResolutionConfig` in `types.ts`. The full change:

```typescript
// Add before ResolutionConfig:
export interface LookupSpec {
  operationName: string
  documentPath: string
  vars: Record<string, string>
}

export interface ResolutionConfig {
  lookup: LookupSpec   // was: inline object type
  inject: InjectSpec[]
}
```

No callers need to change — `ResolutionConfig.lookup` retains the same shape.

**Step 2: Typecheck**

```bash
pnpm run typecheck
```
Expected: no errors.

**Step 3: Run all core tests**

```bash
pnpm --filter @ghx-dev/core exec vitest run
```
Expected: all tests pass.

**Step 4: Commit**

```bash
git add packages/core/src/core/registry/types.ts
git commit -m "refactor(types): extract LookupSpec named interface from ResolutionConfig"
```

---

## Task 3: Align `operation-cards.md` diagram to use `ResolutionConfig` + `LookupSpec`

**Files:**
- Modify: `docs/architecture/operation-cards.md:35-50` (the class diagram block)

The diagram currently writes `ResolutionBlock` for what the TS type calls `ResolutionConfig`. After Task 2 we also have `LookupSpec`. Update the diagram to match.

**Step 1: Find the class diagram block** in `operation-cards.md` (search for `class ResolutionBlock`).

**Step 2: Replace the stale class names:**

Current:
```
    resolution?: ResolutionBlock
...
    class ResolutionBlock {
        lookup: LookupSpec
...
    GraphQLMetadata --> ResolutionBlock
```

Replace with:
```
    resolution?: ResolutionConfig
...
    class ResolutionConfig {
        lookup: LookupSpec
...
    GraphQLMetadata --> ResolutionConfig
```

**Step 3: Verify no other stale `ResolutionBlock` references remain**

```bash
grep -n "ResolutionBlock" docs/architecture/operation-cards.md
```
Expected: no output.

**Step 4: Commit**

```bash
git add docs/architecture/operation-cards.md
git commit -m "docs(arch): align operation-cards diagram to ResolutionConfig + LookupSpec"
```

---

## Task 4: Fix stale capability IDs in docs (`issue.labels.update` → `issue.labels.set`, `issue.assignees.update` → `issue.assignees.set`)

**Files (all docs, NOT `docs/plans/`):**
- `docs/capabilities/issues.md`
- `docs/architecture/operation-cards.md`
- `docs/getting-started/first-task.md`
- `docs/getting-started/README.md`
- `docs/guides/chaining-capabilities.md`
- `docs/guides/cli-usage.md`
- `docs/guides/library-api.md`
- `docs/guides/result-envelope.md`
- `docs/benchmark/workflow-roadmap.md`

The actual YAML card files are `issue.labels.set.yaml` and `issue.assignees.set.yaml`. Every doc that references `issue.labels.update` or `issue.assignees.update` is wrong and will confuse users who copy-paste examples.

**Step 1: Mass replace (run from worktree root)**

```bash
# Replace in all docs except plans/
find docs/ -name "*.md" ! -path "docs/plans/*" \
  -exec sed -i '' \
    -e 's/issue\.labels\.update/issue.labels.set/g' \
    -e 's/issue\.assignees\.update/issue.assignees.set/g' \
    {} +
```

**Step 2: Verify no stale references remain outside plans/**

```bash
grep -rn "issue\.labels\.update\|issue\.assignees\.update" docs/ --include="*.md" \
  | grep -v "docs/plans/"
```
Expected: no output.

**Step 3: Spot-check two files** to make sure the replacements look correct (not double-replaced or mangled):

```bash
grep -n "issue\.labels\|issue\.assignees" docs/guides/chaining-capabilities.md | head -10
grep -n "issue\.labels\|issue\.assignees" docs/capabilities/issues.md | head -10
```

**Step 4: Run core tests** (no code changed, but sanity check)

```bash
pnpm --filter @ghx-dev/core exec vitest run
```

**Step 5: Commit**

```bash
git add docs/
git commit -m "docs: fix stale capability IDs issue.labels.update→set and issue.assignees.update→set"
```

---

## Task 5: Remove `issue.comments.create` from non-batchable table in followup plan

**Files:**
- Modify: `docs/plans/2026-02-20-atomic-chaining-followup.md:110`

The table at line ~104 lists "CLI-only mutations that cannot be chained". `issue.comments.create` has a note "(already batchable)" and a "✓ done" status — it shouldn't be in this table at all.

**Step 1: Delete the row** (the line that reads):
```
| `issue.comments.create` (already batchable) | ✓ done |
```

**Step 2: Commit**

```bash
git add docs/plans/2026-02-20-atomic-chaining-followup.md
git commit -m "docs(plans): remove issue.comments.create from non-batchable candidates table"
```

---

## Task 6: Use `@core/` alias imports in `chain.ts`

**Files:**
- Modify: `packages/core/src/cli/commands/chain.ts:1-2`

All multi-level relative imports in this package use `@core/` aliases per CLAUDE.md. `chain.ts` currently uses raw relative paths for two deep imports.

**Step 1: Replace the two imports** at the top of `chain.ts`:

```typescript
// Before:
import { executeTasks } from "../../core/routing/engine.js"
import { createGithubClient } from "../../gql/github-client.js"

// After:
import { executeTasks } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/github-client.js"
```

Leave line 3 (`import { readStdin } from "./run.js"`) unchanged — that's a same-directory relative import, correct per convention.

**Step 2: Typecheck**

```bash
pnpm run typecheck
```
Expected: no errors.

**Step 3: Run chain-command tests**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/chain-command.test.ts
```
Expected: all 10 tests pass.

**Step 4: Commit**

```bash
git add packages/core/src/cli/commands/chain.ts
git commit -m "refactor(chain): use @core/ path aliases instead of deep relative imports"
```

---

## Task 7: Detect missing alias key in result assembly (`engine.ts`)

**Files:**
- Modify: `packages/core/src/core/routing/engine.ts:470-472`

Current code at line 470:
```typescript
const data = rawMutResult[mutInput.alias]
return { task: req.task, ok: true, data }
```

If `rawMutResult` doesn't contain the alias key (e.g., GitHub returned a partial response without the alias), `data` is `undefined` and the step is incorrectly marked `ok: true`. Use the `in` operator to distinguish "key present with undefined value" from "key absent".

**Step 1: Write the failing test** — add to the "executeTasks chaining" describe block in `engine.test.ts` (after the existing batch mutation tests). Use `vi.resetModules()` pattern:

```typescript
it("marks step as failed when mutation result alias is missing from response", async () => {
  vi.resetModules()
  vi.doMock("@core/core/execute/execute.js", () => ({
    execute: (...args: unknown[]) => executeMock(...args),
  }))
  vi.doMock("@core/core/registry/index.js", () => ({
    getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
  }))
  vi.doMock("@core/gql/document-registry.js", () => ({
    getLookupDocument: vi.fn(),
    getMutationDocument: vi.fn().mockReturnValue("mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }"),
  }))
  vi.doMock("@core/gql/batch.js", () => ({
    buildBatchQuery: vi.fn(),
    buildBatchMutation: vi.fn().mockReturnValue({ document: "mutation {}", variables: {} }),
  }))
  vi.doMock("@core/gql/resolve.js", () => ({
    applyInject: vi.fn(),
    buildMutationVars: vi.fn().mockReturnValue({ issueId: "I1" }),
  }))

  getOperationCardMock.mockReturnValue({
    ...baseCard,
    graphql: { operationName: "IssueClose", documentPath: "x" },
  })

  const { executeTasks } = await import("@core/core/routing/engine.js")

  const queryMock = vi.fn()
    // Phase 1: no lookups (no resolution on either card)
    // Phase 2: response is missing the alias key entirely
    .mockResolvedValueOnce({ step1: { closeIssue: { issue: { id: "I2" } } } }) // step0 key absent

  const result = await executeTasks(
    [
      { task: "issue.close", input: { issueId: "I1" } },
      { task: "issue.close", input: { issueId: "I2" } },
    ],
    { githubClient: createGithubClient({ query: queryMock }) },
  )

  const r0 = result.results[0]
  expect(r0?.ok).toBe(false)
  expect(r0?.error?.message).toContain("missing")
  expect(result.results[1]?.ok).toBe(true)
})
```

**Step 2: Run to confirm it fails**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts -t "missing mutation result"
```
Expected: FAIL (step 0 currently returns `ok: true` with `data: undefined`).

**Step 3: Fix the assembly block** in `engine.ts` (lines 469-472):

```typescript
// Before:
    const data = rawMutResult[mutInput.alias]
    return { task: req.task, ok: true, data }

// After:
    if (!(mutInput.alias in rawMutResult)) {
      return {
        task: req.task,
        ok: false,
        error: {
          code: errorCodes.Unknown,
          message: `missing mutation result for alias ${mutInput.alias}`,
          retryable: false,
        },
      }
    }
    const data = rawMutResult[mutInput.alias]
    return { task: req.task, ok: true, data }
```

**Step 4: Run to confirm it passes**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts
```
Expected: all 14 tests pass.

**Step 5: Commit**

```bash
git add packages/core/src/core/routing/engine.ts packages/core/test/unit/engine.test.ts
git commit -m "fix(engine): detect missing alias key in result assembly via 'in' operator"
```

---

## Task 8: Derive `retryable` from error code in batch failure paths

**Files:**
- Modify: `packages/core/src/core/routing/engine.ts:360-381` (Phase 1 catch) and `:438-454` (Phase 2 catch)

Both catch blocks currently hardcode `retryable: true`. Auth and validation errors are not retryable — hardcoding `true` could cause agents to retry permanently on permanent failures.

**Step 1: Add a local helper** at the top of the `executeTasks` function body (before the pre-flight loop), or as a module-level private function:

```typescript
function isRetryableCode(code: string): boolean {
  return (
    code === errorCodes.RateLimit ||
    code === errorCodes.Network ||
    code === errorCodes.Server
  )
}
```

**Step 2: Update Phase 1 catch block** (lines 360-381). Change:

```typescript
    } catch (err) {
      // Phase 1 failure: mark all steps as failed
      const errorMsg = err instanceof Error ? err.message : String(err)
      return {
        status: "failed",
        results: requests.map((req) => ({
          task: req.task,
          ok: false,
          error: {
            code: mapErrorToCode(err),
            message: `Phase 1 (resolution) failed: ${errorMsg}`,
            retryable: true,                        // ← hardcoded
```

To:

```typescript
    } catch (err) {
      // Phase 1 failure: mark all steps as failed
      const errorMsg = err instanceof Error ? err.message : String(err)
      const code = mapErrorToCode(err)
      return {
        status: "failed",
        results: requests.map((req) => ({
          task: req.task,
          ok: false,
          error: {
            code,
            message: `Phase 1 (resolution) failed: ${errorMsg}`,
            retryable: isRetryableCode(code),       // ← derived
```

**Step 3: Update Phase 2 catch block** (lines 438-454). Change:

```typescript
          stepPreResults[stepIndex] = {
            task: reqAtIndex.task,
            ok: false,
            error: {
              code: mapErrorToCode(err),
              message: err instanceof Error ? err.message : String(err),
              retryable: true,                      // ← hardcoded
```

To:

```typescript
      const code = mapErrorToCode(err)             // compute once outside inner loop
      for (const { stepIndex } of mutationInputs) {
        const reqAtIndex = requests[stepIndex]
        if (reqAtIndex !== undefined) {
          stepPreResults[stepIndex] = {
            task: reqAtIndex.task,
            ok: false,
            error: {
              code,
              message: err instanceof Error ? err.message : String(err),
              retryable: isRetryableCode(code),     // ← derived
```

**Step 4: Add a regression test** to the "executeTasks chaining" describe block, verifying that an auth error is NOT retryable:

```typescript
it("marks batch mutation failure as non-retryable for auth errors", async () => {
  vi.resetModules()
  vi.doMock("@core/core/execute/execute.js", () => ({
    execute: (...args: unknown[]) => executeMock(...args),
  }))
  vi.doMock("@core/core/registry/index.js", () => ({
    getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
  }))
  vi.doMock("@core/gql/document-registry.js", () => ({
    getLookupDocument: vi.fn(),
    getMutationDocument: vi.fn().mockReturnValue("mutation IssueClose { ok }"),
  }))
  vi.doMock("@core/gql/batch.js", () => ({
    buildBatchQuery: vi.fn(),
    buildBatchMutation: vi.fn().mockReturnValue({ document: "mutation {}", variables: {} }),
  }))
  vi.doMock("@core/gql/resolve.js", () => ({
    applyInject: vi.fn(),
    buildMutationVars: vi.fn().mockReturnValue({}),
  }))

  getOperationCardMock.mockReturnValue({
    ...baseCard,
    graphql: { operationName: "IssueClose", documentPath: "x" },
  })

  const { executeTasks } = await import("@core/core/routing/engine.js")

  const authError = new Error("Bad credentials")
  ;(authError as NodeJS.ErrnoException).code = "AUTH"
  const queryMock = vi.fn().mockRejectedValue(authError)

  const result = await executeTasks(
    [
      { task: "issue.close", input: { issueId: "I1" } },
      { task: "issue.close", input: { issueId: "I2" } },
    ],
    { githubClient: createGithubClient({ query: queryMock }) },
  )

  expect(result.status).toBe("failed")
  for (const r of result.results) {
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.retryable).toBe(false)
    }
  }
})
```

**Step 5: Run all engine tests**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts
```
Expected: all tests pass.

**Step 6: Typecheck**

```bash
pnpm run typecheck
```

**Step 7: Commit**

```bash
git add packages/core/src/core/routing/engine.ts packages/core/test/unit/engine.test.ts
git commit -m "fix(engine): derive retryable from error code instead of hardcoding true in batch failure paths"
```

---

## Final verification

```bash
pnpm run ci --outputStyle=static
```

Expected:
- All tests pass (should be 15+ in engine.test.ts)
- Coverage ≥ 90% branch
- Typecheck, lint, format all green
