---
"@ghx-dev/core": minor
---

# First Public Release

**ghx** is a typed GitHub execution router for AI agents. One capability interface. Deterministic routing. Normalized results. No more agents fumbling through `gh` CLI docs on every run.

## The Problem

When agents interact with GitHub, they waste tokens re-discovering API surfaces, parsing inconsistent outputs, and handling errors ad hoc. Common PR operations that should be straightforward become multi-step research projects.

## What ghx Delivers

Every capability returns a stable envelope: `{ ok, data, error, meta }`. Route selection, retries, fallbacks, and input/output validation are handled automatically through schema-driven operation cards.

### Benchmarked Results (agent_direct vs ghx)

Across 27 runs on common PR operations:

| Metric | Improvement |
|---|---|
| Active tokens | **-37%** fewer tokens consumed |
| Latency | **-32%** faster end-to-end |
| Tool calls | **-33%** fewer tool invocations |
| Success rate | **100%** for both (zero regressions) |

Agents using ghx skip the research phase entirely: no manual route discovery, no output guessing, no wasted reasoning tokens.

### 66 Capabilities Shipped

**Repository and issues** -- `repo.view`, `issue.view`, `issue.list`, `issue.comments.list`, `issue.create`, `issue.update`, `issue.close`, `issue.reopen`, `issue.delete`, `issue.labels.update`, `issue.assignees.update`, `issue.milestone.set`, `issue.comments.create`, `issue.linked_prs.list`, `issue.relations.get`, `issue.parent.set`, `issue.parent.remove`, `issue.blocked_by.add`, `issue.blocked_by.remove`

**PR review and merge** -- `pr.view`, `pr.list`, `pr.comments.list`, `pr.reviews.list`, `pr.diff.list_files`, `pr.status.checks`, `pr.checks.get_failed`, `pr.mergeability.view`, `pr.comment.reply`, `pr.comment.resolve`, `pr.comment.unresolve`, `pr.ready_for_review.set`, `pr.review.submit_approve`, `pr.review.submit_request_changes`, `pr.review.submit_comment`, `pr.merge.execute`, `pr.checks.rerun_failed`, `pr.checks.rerun_all`, `pr.reviewers.request`, `pr.assignees.update`, `pr.branch.update`

**CI diagnostics** -- `check_run.annotations.list`, `workflow_runs.list`, `workflow_run.jobs.list`, `workflow_job.logs.get`, `workflow_job.logs.analyze`

**Release and delivery** -- `release.list`, `release.get`, `release.create_draft`, `release.update`, `release.publish_draft`, `workflow_dispatch.run`, `workflow_run.rerun_failed`, `workflow_run.rerun_all`, `workflow_run.cancel`, `workflow_run.get`, `workflow_run.artifacts.list`, `workflow.list`, `workflow.get`

**Projects v2 and repo metadata** -- `project_v2.org.get`, `project_v2.user.get`, `project_v2.fields.list`, `project_v2.items.list`, `project_v2.item.add_issue`, `project_v2.item.field.update`, `repo.labels.list`, `repo.issue_types.list`

### Core Features

- **Deterministic routing** -- each capability declares a `preferred` route and ordered `fallbacks`; the engine follows the plan without guesswork
- **Runtime validation** -- AJV-powered input/output schema validation from operation cards catches errors before they reach GitHub
- **Structured error taxonomy** -- canonical error codes (`AUTH`, `NOT_FOUND`, `RATE_LIMIT`, `VALIDATION`, ...) with `retryable` flags for predictable automation behavior
- **Attempt metadata** -- every result includes `meta.attempts` detailing route, status, duration, and error codes per try
- **CLI and library API** -- use `ghx run <capability>` from the terminal or `executeTask()` from code; `createGithubClientFromToken()` sets up a client in one line
- **Agent interface** -- `@ghx-dev/core/agent` exports `createExecuteTool`, `listCapabilities`, `explainCapability`, and `MAIN_SKILL_TEXT` for agent frameworks
- **Capability discovery** -- `ghx capabilities list` and `ghx capabilities explain <id>` for interactive exploration
- **Agent onboarding** -- `ghx setup --platform claude-code` installs ghx as a project skill with a single command
- **GraphQL + CLI adapters** -- dual execution paths with automatic fallback across routes
- **GitHub Enterprise support** -- `GH_HOST` and `GITHUB_GRAPHQL_URL` for enterprise endpoints

### Quick Start

```bash
npx @ghx-dev/core capabilities list
npx @ghx-dev/core run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```
