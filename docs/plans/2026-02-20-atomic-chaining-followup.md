# Atomic Chaining — Follow-up Work

> Status snapshot after `feat/atomic-chaining` implementation.
> 18 capabilities are now batchable. Items below are improvements and gaps
> discovered during implementation.
>
> **Last updated:** 2026-02-21 (PR #60 review fixes applied)

---

## 1. SKILL.md — update for agents

**File:** `packages/core/skills/using-ghx/SKILL.md`

Current state: no mention of `ghx chain` or `executeTasks`. Stale count (says 69,
should be 66). Domain list still includes `check_run` (removed in PR #58).

**Required changes:**

- Update capability count: 69 → 66
- Remove `check_run` from domain list
- Add a "Chain" section covering:
  - When to prefer `ghx chain` over repeated `ghx run` (multi-mutation atomicity)
  - Syntax: `ghx chain --steps '[{"task":"...","input":{...}},...]'`
  - stdin variant: `ghx chain --steps -`
  - Output shape: `{ status, results[], meta }` — check `status` first
  - Which capabilities are chainable (those taking node IDs or human-readable
    fields; everything with a `graphql:` block)
  - Example: close + comment on an issue in one round-trip

---

## 2. Benchmark — add chaining scenarios

No scenarios exercise `executeTasks` / `ghx chain`. The benchmark only tests single
`ghx run` calls.

**Required work:**

- Add at least 2 workflow scenarios that require a multi-step mutation chain:
  - `issue-triage-atomic-wf-001`: set labels + assignee + milestone on an issue in
    a single chain (exercises `issue.labels.set` + `issue.assignees.set` +
    `issue.milestone.set` — all three have resolution lookups)
  - `pr-review-submit-atomic-wf-001`: submit a review with inline comments
    (exercises `pr.reviews.submit` with PrNodeId resolution)
- Add to `scenario-sets.json` under a `chaining` set and include representative
  scenarios in `default`
- Confirm assertion format handles `ChainResultEnvelope` (status + nested results)

---

## 3. GQL — partial error handling in Phase 2 ✅ Done

**Resolved in PR #60.** Phase 2 now uses `queryRaw` which returns `{data, errors}`
without throwing. Per-step errors are mapped by `path[0]` alias. Individual step
failures produce `status: "partial"` while preserving successful step data.

Additional hardening applied:
- `GraphqlError.path` typed as `ReadonlyArray<string | number>` per spec
- `queryRaw` normalizes transport errors consistently via try/catch
- Step error check uses `!== undefined` instead of truthy check
- Cache guards against `undefined` values from missing batch aliases

---

## 4. GQL — cross-step data passing

**Current limitation:** `executeTasks` takes static inputs per step. There is no
way for step N to use output from step N-1 as its input — each step's input must
be fully specified by the caller upfront.

**Example gap:** "Create an issue, then immediately set it as a child of another
issue" requires two separate round-trips today:
1. `executeTask("issue.create", ...)` → get new `issueId` from result
2. `executeTask("issue.relations.parent.set", { issueId: <from step 1>, ... })`

**Proposed design (for evaluation):**

Allow step inputs to reference prior step outputs via a template syntax, e.g.:
```json
[
  { "task": "issue.create", "input": { "repositoryId": "R_x", "title": "Bug" } },
  { "task": "issue.relations.parent.set",
    "input": { "issueId": "{{steps.0.data.id}}", "parentIssueId": "I_parent" } }
]
```

This would require a pre-processing pass in `executeTasks` after each phase to
resolve template references from accumulated results. Adds significant complexity —
evaluate whether the use-case frequency justifies it.

---

## 5. GQL — expand chainable coverage for currently CLI-only mutations (partially done)

Several useful mutations were CLI-only and could not be chained. Status:

| Capability | Status | Notes |
|---|---|---|
| `issue.labels.remove` | ⬜ Pending | Mutation file and codegen exist; GraphQL handler not registered in engine (CLI-only route active). Remaining: register GraphQL handler in card routing or engine. |
| `issue.assignees.add` | ✅ Done (PR #60) | Full GraphQL handler registered |
| `issue.assignees.remove` | ✅ Done (PR #60) | Full GraphQL handler registered |
| `issue.milestone.clear` | ⬜ Pending | Needs: GraphQL mutation file, codegen, card YAML update, and handler registration. null_literal inject type now supports the variable injection. |

**Remaining work:** `issue.labels.remove` needs GraphQL handler registration and
card YAML updates (mutation file and codegen already exist). `issue.milestone.clear`
needs a GraphQL mutation file, codegen, card YAML updates, and handler registration.

---

## 6. Resolution — cache lookup results across calls ✅ Done

**Resolved in PR #60.** `resolution-cache.ts` implements a TTL-based cache keyed by
`operationName:stableStringify(variables)`. Hardened in review:
- Expired entries are swept before FIFO eviction
- `undefined` values are not cached
- Full test coverage for TTL, eviction, and sweep behavior

---

## 7. Test coverage — new mutations not individually exercised

The 11 newly registered mutations (`IssueClose`, `IssueReopen`, `IssueDelete`,
`IssueUpdate`, `IssueCommentCreate`, `IssueParentSet`, `IssueBlockedByAdd`,
`IssueBlockedByRemove`, `PrCommentReply`, `PrCommentResolve`, `PrCommentUnresolve`)
and the new `PrReviewSubmit` + `PrNodeId` are registered in `document-registry.ts`
but not individually exercised by any unit test.

**Required work:**

- Add a test in `registry-validation.test.ts` (or a new
  `document-registry.test.ts`) that:
  - Asserts `getMutationDocument` succeeds for all 18 registered mutations
  - Asserts `getLookupDocument` succeeds for all 6 registered lookups
- Add an `executeTasks` integration test for at least one of the new "no-resolution"
  mutations (e.g. `issue.close`) to confirm the full Phase 2 path works end-to-end
  with a mocked `githubClient.query`

---

## 8. `pr.reviews.submit` resolution — validate inject path

The new resolution for `pr.reviews.submit` injects `pullRequestId` from
`repository.pullRequest.id` (scalar inject). This was added based on the
`PrNodeIdQuery` type signature. It should be validated with a real GitHub API call
before the PR merges, since the path must exactly match the live response structure.

**Validation step:** add an integration test or run manually against a test repo:
```bash
ghx chain --steps '[
  {"task":"pr.reviews.submit",
   "input":{"owner":"<org>","name":"<repo>","prNumber":1,"event":"COMMENT","body":"test"}}
]'
```
Confirm `status: "success"` and `pullRequestId` was correctly resolved.
