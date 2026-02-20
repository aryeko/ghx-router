---
"@ghx-dev/core": minor
---

Standardize all capability IDs to consistent naming conventions.

**Renamed capabilities:**

- `pr.thread.*` → `pr.threads.*` (list, reply, resolve, unresolve)
- `pr.review.*` → `pr.reviews.*` (list, request, submit)
- `pr.checks.rerun_all` → `pr.checks.rerun.all`
- `pr.checks.rerun_failed` → `pr.checks.rerun.failed`
- `workflow.get` → `workflow.view`
- `workflow.dispatch.run` → `workflow.dispatch`
- `workflow.run.rerun_all` → `workflow.run.rerun.all`
- `workflow.run.rerun_failed` → `workflow.run.rerun.failed`
- `workflow.job.logs.get` → `workflow.job.logs.view`
- `project_v2.org.get` → `project_v2.org.view`
- `project_v2.user.get` → `project_v2.user.view`
- `project_v2.item.add_issue` → `project_v2.items.issue.add`
- `project_v2.item.field.update` → `project_v2.items.field.update`
- `release.get` → `release.view`
- `release.create_draft` → `release.create`
- `release.publish_draft` → `release.publish`
- `issue.labels.update` → `issue.labels.set`
- `issue.assignees.update` → `issue.assignees.set`
- `issue.relations.get` → `issue.relations.view`
- `issue.linked_prs.list` → `issue.relations.prs.list`
- `issue.parent.set` → `issue.relations.parent.set`
- `issue.parent.remove` → `issue.relations.parent.remove`
- `issue.blocked_by.add` → `issue.relations.blocked_by.add`
- `issue.blocked_by.remove` → `issue.relations.blocked_by.remove`

**New capabilities:**

- `issue.labels.remove` — remove specific labels from an issue
- `issue.assignees.add` — add assignees without replacing existing
- `issue.assignees.remove` — remove specific assignees
- `issue.milestone.clear` — remove milestone from an issue
- `pr.assignees.add` — add assignees to a PR
- `pr.assignees.remove` — remove assignees from a PR
- `project_v2.items.issue.remove` — remove an issue from a Projects v2 project

**Retired capabilities:**

- `pr.checks.failed` — merged into `pr.checks.list` (use `state: "failed"` filter)
- `check_run.annotations.list` — annotations now inline in `pr.checks.list` output
- `pr.assignees.update` — replaced by `pr.assignees.add` + `pr.assignees.remove`
- `pr.threads.composite`, `issue.triage.composite`, `issue.update.composite` — composite infrastructure removed

**Output schema changes:**

- All rerun capabilities now return `{ runId: integer, queued: boolean }` (normalized)
- `pr.threads.reply` output now includes `commentId` and `commentUrl`
- `issue.relations.parent.set` output now includes `updated: boolean`
- `issue.relations.blocked_by.add` output now includes `added: boolean`
- `issue.milestone.set` no longer accepts `null` (use `issue.milestone.clear` instead)
