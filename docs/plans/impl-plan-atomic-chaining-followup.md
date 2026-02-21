# Implementation Plan: Atomic Chaining Follow-up

> Derived from `docs/plans/2026-02-20-atomic-chaining-followup.md`.
> Items 3 (GQL partial error handling) and 6 (resolution cache) are already done per PR #60.
> Items 5a (`issue.labels.remove`) and 5b (`issue.milestone.clear`) are already done —
> both have GraphQL handlers registered in `document-registry.ts` and integration tests.
> Item 4 (cross-step data passing) is deferred — see §4 below.

---

## Status

| # | Item | Status |
|---|------|--------|
| 1 | SKILL.md update | ✅ Done (this PR) |
| 2 | Benchmark chaining scenarios | ✅ Done (this PR) |
| 3 | GQL partial error handling | ✅ Done (PR #60) |
| 4 | Cross-step data passing | Deferred (design only) |
| 5 | Expand chainable coverage | ✅ Done (PR #60) |
| 6 | Resolution cache | ✅ Done (PR #60) |
| 7 | Document registry test coverage | ✅ Done (this PR) |
| 8 | `pr.reviews.submit` resolution validation | ✅ Done (this PR) |

---

## 1. SKILL.md Update

**File:** `packages/core/skills/using-ghx/SKILL.md`

### 1a. Fix stale metadata

- Update frontmatter description: `"69 capabilities"` → `"70 capabilities"` (70 `.yaml` files
  in `packages/core/src/core/registry/cards/`).
- Remove `check_run` from the Domains line. New list:
  `repo`, `issue`, `pr`, `release`, `workflow`, `project_v2`.

### 1b. Add "Chain" section

Insert after the "Execute" section. Cover:

1. **When to prefer `ghx chain`** — use when ≥2 mutations must succeed together (labelling
   + assigning + milestoning an issue; submitting a review). Avoids partial state from
   sequential `ghx run` calls.
2. **Syntax:**
   ```bash
   ghx chain --steps '[
     {"task":"issue.close","input":{"issueId":"I_abc"}},
     {"task":"issue.comments.create","input":{"owner":"o","name":"r","issueNumber":1,"body":"Closed."}}
   ]'
   ```
3. **stdin variant:**
   ```bash
   ghx chain --steps - <<'EOF'
   [{"task":"...","input":{...}}]
   EOF
   ```
4. **Output shape:** `{ status, results[], meta }`. Check `status` first
   (`"success"` | `"partial"` | `"failed"`). Each `results[i]` has `{ task, ok, data | error }`.
5. **Chainable capabilities** — any capability whose card has a `graphql:` block. These
   are all capabilities that take node IDs or perform lookups internally. Capabilities with
   only a `cli:` route cannot be chained.
6. **Example:** close an issue and leave a closing comment atomically (as above).

---

## 2. Benchmark Chaining Scenarios

### 2a. New scenario files

Create directory `packages/benchmark/scenarios/chaining/` and add two scenario JSON files.

**`packages/benchmark/scenarios/chaining/issue-triage-atomic-wf-001.json`**

```json
{
  "type": "workflow",
  "id": "issue-triage-atomic-wf-001",
  "name": "Atomically triage issue: set labels, assignee, and milestone in one chain",
  "prompt": "Issue #{{issueNumber}} in {{owner}}/{{name}} needs atomic triage. In a single ghx chain call, set the label 'bug', assign it to the first available assignee using issue.assignees.set, and set milestone number 1 using issue.milestone.set. Do not use separate ghx run calls.",
  "expected_capabilities": ["issue.labels.set", "issue.assignees.set", "issue.milestone.set"],
  "timeout_ms": 180000,
  "allowed_retries": 1,
  "fixture": {
    "repo": "aryeko/ghx-bench-fixtures",
    "bindings": {
      "input.owner": "repo.owner",
      "input.name": "repo.name",
      "input.issueNumber": "resources.issue.number"
    },
    "requires": ["issue"]
  },
  "assertions": {
    "expected_outcome": "success",
    "checkpoints": [
      {
        "name": "issue_has_bug_label",
        "verification_task": "issue.view",
        "verification_input": {},
        "condition": "non_empty"
      }
    ]
  },
  "tags": ["workflow", "chaining", "issue", "atomic"]
}
```

**`packages/benchmark/scenarios/chaining/pr-review-submit-atomic-wf-001.json`**

```json
{
  "type": "workflow",
  "id": "pr-review-submit-atomic-wf-001",
  "name": "Atomically submit a PR review with inline comment via chain",
  "prompt": "PR #{{prNumber}} in {{owner}}/{{name}} needs a review. Use ghx chain with pr.reviews.submit to submit a COMMENT review with body 'Reviewed atomically via chain.' Do not use separate ghx run calls.",
  "expected_capabilities": ["pr.reviews.submit"],
  "timeout_ms": 180000,
  "allowed_retries": 1,
  "fixture": {
    "repo": "aryeko/ghx-bench-fixtures",
    "bindings": {
      "input.owner": "repo.owner",
      "input.name": "repo.name",
      "input.prNumber": "resources.pr.number"
    },
    "requires": ["pr"]
  },
  "assertions": {
    "expected_outcome": "success",
    "checkpoints": [
      {
        "name": "review_submitted",
        "verification_task": "pr.reviews.list",
        "verification_input": {},
        "condition": "non_empty"
      }
    ]
  },
  "tags": ["workflow", "chaining", "pr", "atomic"]
}
```

### 2b. Update `scenario-sets.json`

Add a `chaining` set and add the two new scenario IDs to `default` and `all`:

```json
{
  "default": [
    "pr-fix-review-comments-wf-001",
    "issue-triage-comment-wf-001",
    "pr-review-comment-wf-001",
    "ci-diagnose-run-wf-001",
    "issue-triage-atomic-wf-001",
    "pr-review-submit-atomic-wf-001"
  ],
  "workflows": [
    "pr-fix-review-comments-wf-001",
    "issue-triage-comment-wf-001",
    "pr-review-comment-wf-001",
    "ci-diagnose-run-wf-001"
  ],
  "chaining": [
    "issue-triage-atomic-wf-001",
    "pr-review-submit-atomic-wf-001"
  ],
  "all": [
    "pr-fix-review-comments-wf-001",
    "issue-triage-comment-wf-001",
    "pr-review-comment-wf-001",
    "ci-diagnose-run-wf-001",
    "issue-triage-atomic-wf-001",
    "pr-review-submit-atomic-wf-001"
  ],
  "full-seeded": [
    "pr-fix-review-comments-wf-001",
    "issue-triage-comment-wf-001",
    "pr-review-comment-wf-001",
    "ci-diagnose-run-wf-001"
  ]
}
```

### 2c. Assertion format note

The benchmark runner evaluates assertions by running verification tasks via `executeTask`
(not by parsing `ChainResultEnvelope` directly). Checkpoints inspect final GitHub state,
so no changes to the assertion runner are needed.

---

## 4. Cross-step data passing (Deferred)

The design is described in the follow-up doc (Item 4). It requires template interpolation
(`{{steps.0.data.id}}`) and a pre-processing pass in `executeTasks`. Given complexity and
unclear demand, defer to a dedicated planning session when a concrete use case arises.

---

## 7. Document Registry Test Coverage

### 7a. Expand `document-registry.test.ts`

**File:** `packages/core/test/unit/document-registry.test.ts`

Replace the current 5-test file with exhaustive coverage. Add one `it` per registered
operation (rather than a data-driven loop) so individual failures name the broken operation.

**Mutations to cover** (21 total, from `MUTATION_DOCUMENTS`):
`IssueAssigneesAdd`, `IssueAssigneesRemove`, `IssueAssigneesUpdate`,
`IssueBlockedByAdd`, `IssueBlockedByRemove`,
`IssueClose`, `IssueCommentCreate`, `IssueCreate`, `IssueDelete`,
`IssueLabelsAdd`, `IssueLabelsRemove`, `IssueLabelsUpdate`,
`IssueMilestoneSet`, `IssueParentRemove`, `IssueParentSet`,
`IssueReopen`, `IssueUpdate`,
`PrCommentReply`, `PrCommentResolve`, `PrCommentUnresolve`,
`PrReviewSubmit`

**Lookups to cover** (9 total, from `LOOKUP_DOCUMENTS`):
`IssueAssigneesLookup`, `IssueAssigneesLookupByNumber`,
`IssueCreateRepositoryId`,
`IssueLabelsLookup`, `IssueLabelsLookupByNumber`,
`IssueMilestoneLookup`, `IssueNodeIdLookup`,
`IssueParentLookup`, `PrNodeId`

Pattern for each assertion:
```ts
it("getMutationDocument returns IssueClose", () => {
  expect(getMutationDocument("IssueClose")).toContain("mutation IssueClose")
})
```

Keep existing `throws on unknown` tests.

### 7b. New `executeTasks` integration test — no-resolution mutation

**File:** `packages/core/test/integration/engine-execute-tasks-no-resolution.integration.test.ts`

Test `executeTasks` with `issue.close` (no `resolution` config — skips Phase 1, goes
directly to Phase 2 batch mutation).

Key mock: `githubClient.queryRaw` returns
```ts
{
  data: {
    step0: {
      closeIssue: { issue: { id: "I_abc", number: 10, state: "CLOSED", closed: true } }
    }
  }
}
```

Assertions:
- `status === "success"`
- `results[0].ok === true`
- `results[0].data` contains `{ state: "CLOSED", closed: true }`
- `meta.succeeded === 1`, `meta.failed === 0`

Also add a two-step no-resolution test (`issue.close` + `issue.reopen` is not useful,
but `issue.close` + `issue.comments.create` with `issueId` can demonstrate batching):
- Mock `queryRaw` returns `{ data: { step0: {...closeIssue...}, step1: {...createIssueComment...} } }`
- Verify `status === "success"`, `results.length === 2`, both `ok === true`

---

## 8. `pr.reviews.submit` Resolution Validation

**File:** `packages/core/test/integration/engine-execute-tasks-pr-review-submit.integration.test.ts`

Test `executeTasks` with `pr.reviews.submit`, which has a Phase 1 resolution:
- **Lookup:** `PrNodeId` query → extracts `repository.pullRequest.id`
- **Inject:** `pullRequestId` ← scalar from `repository.pullRequest.id`
- **Mutation:** `PrReviewSubmit`

### Mocks required

Phase 1 uses `githubClient.query(batchQueryDocument, variables)`:
```ts
async query<TData>(query: string): Promise<TData> {
  if (query.includes("PrNodeId")) {
    return {
      step0: { repository: { pullRequest: { id: "PR_xyz789" } } }
    } as TData
  }
  throw new Error("unexpected query")
}
```

Phase 2 uses `githubClient.queryRaw<Record<string, unknown>>(document, variables)`:
```ts
async queryRaw<TData>(query: string): Promise<{ data?: TData; errors?: ... }> {
  if (query.includes("PrReviewSubmit")) {
    return {
      data: {
        step0: {
          addPullRequestReview: {
            pullRequestReview: {
              id: "review-id-1",
              state: "COMMENTED",
              url: "https://github.com/.../pull/5#pullrequestreview-1",
              body: "Reviewed atomically.",
            }
          }
        }
      }
    } as { data: TData }
  }
  throw new Error("unexpected queryRaw")
}
```

### Assertions

- `status === "success"`
- `results[0].ok === true`
- `results[0].data` contains `{ state: "COMMENTED" }` — confirming the Phase 2 mutation
  result was correctly mapped
- Verify `query` was called once (Phase 1 lookup) and `queryRaw` was called once (Phase 2)
  — use `vi.fn()` spies on the client methods

---

## Execution Order

1. **Item 7a** — expand `document-registry.test.ts` (purely additive, no risk)
2. **Item 1** — update `SKILL.md` (documentation only)
3. **Item 7b** — add `executeTasks` no-resolution integration test
4. **Item 8** — add `executeTasks` pr.reviews.submit integration test
5. **Item 2** — add benchmark scenarios and update `scenario-sets.json`
6. Run `pnpm run ci --outputStyle=static` to verify all pass

---

## Pre-PR Checklist

- [x] `pnpm run ci --outputStyle=static` passes
- [x] No GraphQL operation files changed (no codegen needed)
- [x] Coverage for touched files ≥90%
- [x] No public API changes (no changeset needed)
