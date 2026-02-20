# Atomic Chaining — Follow-up Work

> Status snapshot after `feat/atomic-chaining` implementation.
> 18 capabilities are now batchable. Items below are improvements and gaps
> discovered during implementation.

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

## 3. GQL — partial error handling in Phase 2

**Current behavior:** if `githubClient.query()` throws during Phase 2 (the batch
mutation), all steps are marked failed. But GitHub GraphQL returns HTTP 200 even
when individual mutations error — errors appear in the `errors[]` field alongside
partial `data`. The chain command (`chain.ts`) already throws on `errors[]`
presence, which means one bad mutation kills the whole batch.

**Required work:**

- In `chain.ts` (or `engine.ts` Phase 2), after receiving the batch mutation
  response, check `data` and `errors` separately:
  - Map each error back to its aliased step (errors include a `path` field like
    `["step1", "createIssue"]`)
  - Mark only the failed step(s) as `ok: false`; keep successful step data
  - Update `ChainStatus` to `partial` if some steps succeeded
- This requires changing `GithubClient.query()` to return raw `{data, errors}`
  instead of throwing, or a new lower-level method for chain use

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

## 5. GQL — expand chainable coverage for currently CLI-only mutations

Several useful mutations are CLI-only and cannot be chained. The highest-value
candidates for adding a GraphQL route (and thus making them chainable):

| Capability | Why valuable in chains |
|---|---|
| `issue.labels.remove` | complement to `issue.labels.add` in same chain |
| `issue.assignees.add` | complement to `issue.assignees.set` in same chain |
| `issue.assignees.remove` | complement to `issue.assignees.set` in same chain |
| `issue.milestone.clear` | complement to `issue.milestone.set` in same chain |

For each: add a GraphQL mutation `.graphql` file, run codegen, add to card YAML
(`graphql:` block), register in `MUTATION_DOCUMENTS`. Milestone clear and label
remove need resolution lookups (need the current milestone/label IDs).

---

## 6. Resolution — cache lookup results across calls

**Current behavior:** every `executeTasks` call re-fetches all Phase 1 lookups
(label IDs, assignee IDs, milestone IDs, etc.) even if the same repo's data was
fetched in a recent prior call.

**Opportunity:** a short-lived in-memory cache keyed by `(operationName, variables)`
with a TTL (e.g. 60s) would eliminate redundant lookups for agents issuing multiple
chains against the same repo in rapid succession.

**Note:** Phase 1 already batches lookups within a single chain into one HTTP
request. This is about cross-call caching, not intra-chain batching.

**Scope:** small addition to `engine.ts` or a dedicated `resolution-cache.ts`
module. Use same WeakMap + TTL pattern as the existing CLI environment cache.

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
