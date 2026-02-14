# Capability Roadmap Design: Adoption-Oriented Expansion (Setup + Batches A-D)

**Status:** Planned  
**Date:** 2026-02-14  
**Audience:** Core runtime engineers, benchmark maintainers, OSS maintainers

---

## 1) Motivation

`ghx` already provides strong PR review and CI diagnostics foundations, but wider OSS adoption depends on two additional outcomes:

1. New users can install and validate quickly (`ghx setup`).
2. Agents can complete full day-to-day GitHub workflows without dropping to ad hoc commands.

The current gap is not only capability count. It is capability continuity across full loops:

- execute PR reviews and merge actions,
- manage issue lifecycle and dependencies,
- run release workflows in draft-first mode,
- operate workflow/project controls used by real automation systems.

This design defines a staged roadmap that keeps `ghx` deterministic and benchmarkable while increasing practical surface area that OSS maintainers actually use.

---

## 2) Goals

1. Deliver a complete adoption path from install to validated first run via `ghx setup`.
2. Expand capability coverage in four batches with explicit boundaries:
   - Batch A: PR execution completeness,
   - Batch B: full issue lifecycle (`issue.*` only),
   - Batch C: release and delivery operations,
   - Batch D: workflow controls + Projects v2 + repo metadata.
3. Keep all new capabilities in card-driven contracts with normalized envelopes.
4. Preserve deterministic routing and bounded execution safeguards.
5. Ensure each batch is benchmarkable with dedicated scenario sets and validation gates.

## 3) Non-goals

- Supporting GitHub classic projects (non-v2).
- Adding `tag.*` capabilities in this roadmap.
- Shipping autonomous fix/remediation behavior.
- Replacing existing envelope contract or routing engine architecture.

---

## 4) Guiding Principles

1. **Atomic capabilities over app-specific bundles**: avoid app-shaped endpoints like `repo.context.get`.
2. **Explicit intent naming**: prefer capability verbs such as `release.create_draft` and `release.publish_draft`.
3. **Read-before-write progression**: add list/get capabilities before create/update mutations in each domain.
4. **Default safety**: mutating operations are explicit and never hidden in default benchmark paths.
5. **Backward compatibility**: existing capability behavior and envelope contract remain stable.

---

## 5) Scope and Batch Plan

### 5.1 Track 0: Onboarding (`ghx setup`)

CLI surface:

- `ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]`
- `ghx capabilities list`
- `ghx capabilities explain <capability_id>`

Behavior:

- idempotent writes,
- skill-only installation under `.agents/skill/ghx/SKILL.md`,
- explicit overwrite approval (or `--yes`) for existing skill files,
- explicit dry-run plan,
- explicit verify report,
- opt-in setup telemetry with `--track`.

### 5.2 Batch A: PR execution completeness

- `pr.review.submit_approve`
- `pr.review.submit_request_changes`
- `pr.review.submit_comment`
- `pr.merge.execute`
- `pr.checks.rerun_failed`
- `pr.checks.rerun_all`
- `pr.reviewers.request`
- `pr.assignees.update`
- `pr.branch.update`

### 5.3 Batch B: Issue lifecycle and dependencies (`issue.*`)

- `issue.create`
- `issue.update`
- `issue.close`
- `issue.reopen`
- `issue.delete`
- `issue.labels.update`
- `issue.assignees.update`
- `issue.milestone.set`
- `issue.comments.create`
- `issue.linked_prs.list`
- `issue.relations.get`
- `issue.parent.set`
- `issue.parent.remove`
- `issue.blocked_by.add`
- `issue.blocked_by.remove`

### 5.4 Batch C: Release and delivery operations

- `release.list`
- `release.get`
- `release.create_draft`
- `release.update`
- `release.publish_draft`
- `workflow_dispatch.run`
- `workflow_run.rerun_failed`

### 5.5 Batch D: Workflow controls + Projects v2 + repo metadata

- `workflow.list`
- `workflow.get`
- `workflow_run.get`
- `workflow_run.rerun_all`
- `workflow_run.cancel`
- `workflow_run.artifacts.list`
- `project_v2.org.get`
- `project_v2.user.get`
- `project_v2.fields.list`
- `project_v2.items.list`
- `project_v2.item.add_issue`
- `project_v2.item.field.update`
- `repo.labels.list`
- `repo.issue_types.list`

Note: existing shipped capabilities (for example `workflow_runs.list`, `workflow_run.jobs.list`, `workflow_job.logs.get`, `workflow_job.logs.analyze`) remain canonical and are reused by Batch D workflows.

---

## 6) Routing Strategy (Family-Level)

### 6.1 GraphQL-preferred families

- PR review submissions, reviewer/assignee mutations, branch update metadata where GraphQL is richer.
- Issue lifecycle and dependency relations (`issue.*`) for relation graph semantics.
- Projects v2 operations and repo issue type listing.

### 6.2 CLI-preferred families

- Workflow dispatch/rerun/cancel operations where `gh` has stable operational semantics.
- Release creation/update/publish flows when CLI pathways are stable and simpler.

### 6.3 Contract rule

If fallback cannot preserve required output schema, the operation must return `ADAPTER_UNSUPPORTED` rather than a lossy success shape.

---

## 7) Requirements

### 7.1 Functional requirements

1. Every new operation has a validated card (`capability_id`, route preferences, input/output schema, examples).
2. Batch A must support full PR execution loop (review submit, checks rerun, merge, branch sync).
3. Batch B must support full issue lifecycle and dependency graph mutations.
4. Batch C must enforce draft-first release semantics (`create_draft` -> `update` -> `publish_draft`).
5. Batch D must support Projects v2 operations only (no classic project support).
6. `repo.labels.list` and `repo.issue_types.list` must be independently callable capabilities.
7. `ghx setup` must support both user and project scope in v1.
8. `ghx capabilities list` and `ghx capabilities explain <capability_id>` must be available as CLI discovery commands.

### 7.2 Quality requirements

1. All successful outputs validate against operation card output schema.
2. Validation failures occur before adapter execution.
3. Routing remains deterministic with explicit reason codes.
4. Pagination and scan behavior is bounded and truncation-signaled when needed.
5. New capabilities include clear `explain` summaries and examples.

### 7.3 Safety requirements

1. No token/secret leakage in envelope payloads, telemetry, or errors.
2. CLI executions continue to use safe-runner constraints (`shell: false`, timeout, output bound).
3. Mutating operations require explicit inputs; no hidden mutation side effects.
4. `ghx setup` never silently overwrites an existing skill file.
5. Setup telemetry is emitted only when `--track` is provided.

### 7.4 Adoption requirements

1. Setup-to-verify flow must be executable in less than 5 minutes on a clean environment.
2. Each batch adds at least one complete workflow loop that removes manual glue steps.
3. README and docs must include one golden flow per batch.

---

## 8) Validation Plan

### 8.1 Unit validation

- Card schema validation tests for all added capabilities.
- Adapter tests for each capability family (PR, issue, release, workflow, projects v2, repo metadata).
- Setup and discovery command tests: argument parsing, scope path resolution, overwrite behavior, dry-run, verify output, and setup telemetry gating.

### 8.2 Integration validation

- Engine-level tests per capability family with route plan + fallback behavior.
- Integration tests for mutating operations and expected error code mapping.
- Setup integration tests against fixture directories for user/project modes.

### 8.3 Contract validation

- Assert envelope and output schema conformance on all success paths.
- Assert unknown/unsupported paths return canonical error codes.

### 8.4 Benchmark validation

- Each batch must have a corresponding scenario set and complete mapping (see benchmark design spec).
- Default benchmark set remains stable and mutation-free.

### 8.5 Release-gate commands

```bash
pnpm run build
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run ghx:gql:check
pnpm run benchmark:check
pnpm run ci:affected --parallel=3 --outputStyle=static
```

---

## 9) Rollout Plan

1. Ship Track 0 (`ghx setup`) foundation.
2. Ship Batch A PR execution capabilities.
3. Ship Batch B issue lifecycle (`issue.*`).
4. Ship Batch C release and delivery operations.
5. Ship Batch D workflow + Projects v2 + repo metadata.

Each stage requires:

- cards + adapters + tests,
- benchmark scenario additions,
- docs updates.

---

## 10) Risks and Mitigations

### High

- **Mutation flakiness in CI fixtures**  
  Mitigation: isolate mutation scenarios in non-default benchmark sets and use dedicated fixture repos.

- **Cross-surface naming drift**  
  Mitigation: enforce explicit naming convention and batch-level capability inventory checks.

### Medium

- **Route fallback contract mismatch**  
  Mitigation: explicit `ADAPTER_UNSUPPORTED` when shape cannot be preserved.

- **Setup overwrite prompts in non-interactive environments**  
  Mitigation: require explicit `--yes` in non-interactive runs and provide actionable failure output.

### Low

- **Over-scoping project capabilities**  
  Mitigation: constrain to Projects v2 only in this roadmap.

---

## 11) Acceptance Criteria

1. `ghx setup` supports user/project scopes and passes verify checks.
2. Batch A-D capability cards are implemented and listed by `list_capabilities`.
3. Batch B contains all `issue.*` operations in this roadmap.
4. Batch D includes `repo.labels.list` and excludes classic projects.
5. Every batch has dedicated benchmark scenario coverage and passes benchmark checks.
6. No regression in existing shipped capability behavior.
