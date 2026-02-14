# Benchmark Design: Scenario Sets for Roadmap Batches A-D

**Status:** Planned  
**Date:** 2026-02-14  
**Depends on:** `docs/architecture/capability-roadmap-adoption-design.md`

---

## 1) Motivation

The roadmap introduces a broad set of new capabilities across PR execution, issue lifecycle, release workflows, workflow controls, and Projects v2 operations.

Without explicit scenario-set planning, benchmark behavior risks three failures:

1. default baseline drift as new scenarios are added,
2. accidental inclusion of mutating scenarios in default runs,
3. inability to evaluate batch-level progress and regressions independently.

We need benchmark sets that map exactly to roadmap batches while preserving historical comparability.

---

## 2) Goals

1. Define benchmark scenario sets for each roadmap batch (A-D).
2. Keep default benchmark behavior stable and mutation-free.
3. Provide complete capability-to-scenario mapping for new operations.
4. Ensure scenario selection is deterministic and validated in CI.
5. Define explicit validation requirements and acceptance gates per batch.

## 3) Non-goals

- Redesign benchmark scoring or report gate formulas.
- Auto-resetting all external fixture state for mutating scenarios.
- Merging all roadmap scenarios into the default set.

---

## 4) Scenario Set Model

Set definitions are maintained in `packages/benchmark/scenario-sets.json`.

### 4.1 Required sets

- `default` (unchanged baseline)
- `pr-exec`
- `issues`
- `release-delivery`
- `workflows`
- `projects-v2`
- `all` (union of all roadmap batch sets)

### 4.2 Selection precedence

1. `--scenario <id>`
2. `--scenario-set <name>`
3. implicit `default`

---

## 5) Batch-Level Scenario Design

Scenario IDs below define the intended coverage shape. Exact fixture repo/PR/issue identifiers are environment-specific and remain externalized.

### 5.1 Batch A set (`pr-exec`)

Coverage targets:

- `pr.review.submit_approve`
- `pr.review.submit_request_changes`
- `pr.review.submit_comment`
- `pr.merge.execute`
- `pr.checks.rerun_failed`
- `pr.checks.rerun_all`
- `pr.reviewers.request`
- `pr.assignees.update`
- `pr.branch.update`

Representative scenario IDs:

- `pr-review-submit-approve-001`
- `pr-review-submit-request-changes-001`
- `pr-review-submit-comment-001`
- `pr-merge-execute-001`
- `pr-checks-rerun-failed-001`
- `pr-checks-rerun-all-001`
- `pr-reviewers-request-001`
- `pr-assignees-update-001`
- `pr-branch-update-001`

Assertions:

- envelope success shape and capability id match,
- expected state transition markers (for example merge status changed),
- route and reason metadata present.

### 5.2 Batch B set (`issues`)

Coverage targets (all `issue.*` in roadmap):

- lifecycle: create/update/close/reopen/delete,
- assignment and labeling,
- milestone assignment,
- comment creation,
- linked PR reads,
- dependency relation reads/mutations.

Representative scenario IDs:

- `issue-create-001`
- `issue-update-001`
- `issue-close-001`
- `issue-reopen-001`
- `issue-delete-001`
- `issue-labels-update-001`
- `issue-assignees-update-001`
- `issue-milestone-set-001`
- `issue-comments-create-001`
- `issue-linked-prs-list-001`
- `issue-relations-get-001`
- `issue-parent-set-001`
- `issue-parent-remove-001`
- `issue-blocked-by-add-001`
- `issue-blocked-by-remove-001`

Assertions:

- dependency graph fields are present and well-shaped,
- mutation scenarios verify changed state via follow-up read checks,
- expected canonical errors for unsupported mutations are mapped.

### 5.3 Batch C set (`release-delivery`)

Coverage targets:

- `release.list`
- `release.get`
- `release.create_draft`
- `release.update`
- `release.publish_draft`
- `workflow_dispatch.run`
- `workflow_run.rerun_failed`

Representative scenario IDs:

- `release-list-001`
- `release-get-001`
- `release-create-draft-001`
- `release-update-001`
- `release-publish-draft-001`
- `workflow-dispatch-run-001`
- `workflow-run-rerun-failed-001`

Assertions:

- draft-first lifecycle is enforced,
- publish scenario validates transition from draft to published,
- workflow dispatch/rerun returns run identifiers and queued/executing status fields.

### 5.4 Batch D sets (`workflows`, `projects-v2`)

Coverage targets:

- `workflows`: workflow inspection/control operations, including dispatch/rerun.
- `projects-v2`: Projects v2 operations only, plus repo metadata operations (`repo.labels.list`, `repo.issue_types.list`).

Representative scenario IDs:

- `workflow-list-001`
- `workflow-get-001`
- `workflow-run-get-001`
- `workflow-run-rerun-all-001`
- `workflow-run-cancel-001`
- `workflow-run-artifacts-list-001`
- `project-v2-org-get-001`
- `project-v2-user-get-001`
- `project-v2-fields-list-001`
- `project-v2-items-list-001`
- `project-v2-item-add-issue-001`
- `project-v2-item-field-update-001`
- `repo-labels-list-001`
- `repo-issue-types-list-001`

Assertions:

- project responses are explicitly v2-shaped,
- no classic project fields appear in normalized output,
- list operations provide bounded pagination info.

---

## 6) Requirements

### 6.1 Functional requirements

1. Each new capability in roadmap batches A-D maps to at least one scenario in its batch set.
2. `all` is an exact union of batch sets (A-D).
3. `default` does not include roadmap mutation scenarios.
4. Scenario-set resolution remains deterministic.
5. Scenario errors for unknown set names are explicit and actionable.

### 6.2 Quality requirements

1. Scenario IDs are unique and follow `<domain>-<capability>-<nnn>` naming.
2. Each mutation scenario includes at least one follow-up assertion source (direct response or follow-up read).
3. Set files are validated by `check:scenarios` for missing refs/orphans/duplicates.
4. Benchmark rows include `scenario_set` metadata for set-driven runs.

### 6.3 Safety requirements

1. Mutating scenarios are isolated to non-default sets.
2. Fixture repos/issues/PRs are dedicated and resettable where feasible.
3. No sensitive credentials in scenario files or benchmark artifacts.
4. Potentially destructive operations (for example delete) require dedicated test fixtures and explicit warnings in scenario docs.

---

## 7) Validation Plan

### 7.1 Unit validation

- scenario set loader/resolver tests for all new set names,
- precedence tests for `--scenario` over `--scenario-set`,
- schema validation tests for scenario IDs and set membership.

### 7.2 Integration validation

- benchmark CLI passes scenario-set options to runner,
- runner persists `scenario_set` metadata correctly,
- each batch set executes only scenarios in that set.

### 7.3 Batch completeness validation

Add a static check that compares:

- capability inventory from roadmap batches,
- scenario IDs referenced in corresponding batch sets.

The check fails when a capability is missing benchmark coverage.

### 7.4 Gate commands

```bash
pnpm --filter @ghx-dev/benchmark run check:scenarios
pnpm --filter @ghx-dev/benchmark run test
pnpm --filter @ghx-dev/benchmark run typecheck
pnpm --filter @ghx-dev/benchmark run lint
```

Optional batch run commands:

```bash
pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set pr-exec
pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set issues
pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set release-delivery
pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set workflows
pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set projects-v2
```

---

## 8) Rollout

1. Add batch set definitions to `scenario-sets.json`.
2. Add skeleton scenarios for each new capability with placeholder fixtures.
3. Enable batch-level validation checks in `check:scenarios`.
4. Populate stable fixture targets and tighten assertions.
5. Keep CI default gate on `default`; use roadmap sets for staged expansion and readiness checks.

---

## 9) Acceptance Criteria

1. Scenario sets for batches A-D exist and validate.
2. Every roadmap capability has at least one mapped scenario in its batch set.
3. `all` equals the union of A-D sets.
4. Default set remains stable and mutation-free.
5. Batch runs produce benchmark rows with set metadata and pass benchmark checks.
