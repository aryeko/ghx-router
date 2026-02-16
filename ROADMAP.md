# Roadmap

## Current State

- Shipped capabilities: `repo.view`, `issue.view`, `issue.list`, `issue.comments.list`, `pr.view`, `pr.list`
- Shipped PR review and CI diagnostics capabilities: `pr.comments.list`, `pr.reviews.list`, `pr.diff.list_files`, `pr.status.checks`, `pr.checks.get_failed`, `pr.mergeability.view`, `pr.comment.reply`, `pr.comment.resolve`, `pr.comment.unresolve`, `pr.ready_for_review.set`, `check_run.annotations.list`, `workflow_runs.list`, `workflow_run.jobs.list`, `workflow_job.logs.get`, `workflow_job.logs.analyze`
- CLI-first routing with GraphQL/CLI adapters
- Benchmark harness comparing agent-direct vs ghx execution
- Normalized envelope contract and structured error taxonomy

## Priority Order

1. `ghx setup` onboarding foundation
2. Capability Batches A-D
3. Adoption-prioritized work after A-D

## Decision Locks

- Batch B contains all roadmap `issue.*` capabilities.
- Batch D project support is GitHub Projects v2 only (no classic projects).
- `tag.*` is out of scope for this roadmap.
- Release operations use explicit verbs (for example `release.create_draft`, `release.publish_draft`).

## Delivery Plan

### Track 0: Setup Foundation (first)

- Ship `ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]`.
- Ship `ghx capabilities list` and `ghx capabilities explain <capability_id>` for capability discovery.
- Ensure skill-only installation under `.agents/skills/ghx/SKILL.md`, overwrite prompts, and post-setup verification.

Exit criteria:

- Setup succeeds for both scopes in fixture validation.
- `--dry-run` and `--verify` are reliable.
- Re-run is a no-op when already configured.
- New user can complete setup-to-verify in under 5 minutes.
- Capability discovery subcommands (`list`/`explain`) are available and documented.

### Batch A: PR Execution Completeness

- `pr.review.submit_approve`
- `pr.review.submit_request_changes`
- `pr.review.submit_comment`
- `pr.merge.execute`
- `pr.checks.rerun_failed`
- `pr.checks.rerun_all`
- `pr.reviewers.request`
- `pr.assignees.update`
- `pr.branch.update`

Exit criteria:

- All capabilities listed by `list_capabilities` and schema-validated.
- Benchmark set `pr-exec` passes.
- Docs include one end-to-end PR execution golden flow.

### Batch B: Issue Lifecycle and Dependencies (`issue.*`)

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

Exit criteria:

- All issue lifecycle and dependency operations are contract-tested.
- Benchmark set `issues` passes.
- Mutation fixtures are isolated and stable.

### Batch C: Release and Delivery Operations

- `release.list`
- `release.get`
- `release.create_draft`
- `release.update`
- `release.publish_draft`
- `workflow_dispatch.run`
- `workflow_run.rerun_failed`

Exit criteria:

- Draft-first release semantics are validated.
- Benchmark set `release-delivery` passes.
- Docs include a release lifecycle recipe.

### Batch D: Workflow Controls + Projects v2 + Repo Metadata

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

Exit criteria:

- Projects v2-only scope is preserved.
- Benchmark sets `workflows` and `projects-v2` pass.
- Docs include workflow + project control examples.

## After A-D: Adoption-Prioritized Next Work

### N1: Packaging and Public API Boundaries

- Add explicit package exports and documented stable entrypoints.
- Define and publish versioning/deprecation policy for external consumers.

### N2: Reliability and Compatibility

- Publish GitHub + GH CLI compatibility matrix.
- Expand contract/failure-mode docs and fallback expectations.

### N3: Public ROI Proof

- Publish reproducible benchmark reports comparing ghx vs ad hoc `gh` usage.
- Use benchmark outputs as release-readiness signals.

### N4: Ecosystem Distribution

- Add first-class templates/integrations for major agent environments.
- Publish starter repositories and lightweight RFC path for capability proposals.

## Success Metrics

- Activation: install-to-first-success rate and median time to first successful run
- Retention: 7-day and 30-day returning repositories
- Reliability: envelope/schema pass rate, fallback rate, and normalized error trends
- Reach: stars, forks, external pull requests, and community-contributed workflows

## Canonical Design Specs

- `docs/architecture/cli-subcommands-design.md`
- `docs/architecture/setup-command-design.md`
- `docs/architecture/capability-roadmap-adoption-design.md`
- `docs/benchmark/capability-roadmap-benchmark-sets-design.md`

## Contributing to the Roadmap

Have ideas or want to influence priorities? Open a [Discussion](https://github.com/aryeko/ghx/discussions) or an [Issue](https://github.com/aryeko/ghx/issues).
