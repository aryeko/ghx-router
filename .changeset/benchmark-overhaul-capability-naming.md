---
"@ghx-dev/core": minor
---

### Capability naming overhaul

Renamed all capabilities to follow a consistent `domain.resource.action` pattern. Key renames include:
- `pr.comments.list` → `pr.thread.list`, `pr.comment.reply` → `pr.thread.reply`, `pr.comment.resolve` → `pr.thread.resolve`, `pr.comment.unresolve` → `pr.thread.unresolve`
- `pr.mergeability.view` → `pr.merge.status`, `pr.merge.execute` → `pr.merge`
- `pr.status.checks` → `pr.checks.list`, `pr.checks.get_failed` → `pr.checks.failed`
- `pr.reviews.list` → `pr.review.list`, `pr.reviewers.request` → `pr.review.request`
- `pr.review.submit_approve`/`submit_comment`/`submit_request_changes` → unified `pr.review.submit` with `event` parameter
- `pr.diff.list_files` → `pr.diff.files`, `pr.ready_for_review.set` → removed (replaced by `pr.update`)
- `workflow_run.get` → `workflow.run.view`, `workflow_runs.list` → `workflow.runs.list`, `workflow_run.*` → `workflow.run.*`
- `workflow_job.logs.get` → `workflow.job.logs.raw`, `workflow_job.logs.analyze` → `workflow.job.logs.get`
- Removed redundant `workflow.run.jobs.list` capability

### New capabilities

- `pr.diff.view` — view PR diff content
- `issue.labels.add` — add labels to an issue (non-destructive; complements `issue.labels.update`)
- `pr.create` — create a pull request
- `pr.update` — update PR title/body/base
- `workflow.run.view` (renamed from `workflow_run.get`) — now includes GraphQL routing

### GraphQL improvements

- Extracted 3 shared GraphQL fragments (`PageInfoFields`, `IssueCoreFields`, `PrCoreFields`) reducing field duplication across 10 operation files
- Routed `pr.merge.status` and `repo.view` through GraphQL (preferred) with CLI fallback
- Added `fetchPrMergeStatus` to the GraphQL client

### Capabilities list enrichment

- `capabilities list` now returns `required_inputs` per capability — agents can skip `explain` calls
- `--domain` filter for `ghx capabilities list` (e.g., `--domain pr`)
- Slimmed SKILL.md to reference `required_inputs` in list output

### stdin input support

- `ghx run <task> --input -` reads JSON input from stdin with 10s timeout

### Integration tests

- 58 new integration tests covering all previously untested capabilities
