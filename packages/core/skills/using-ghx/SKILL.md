---
name: using-ghx
description: Execute GitHub operations via ghx — deterministic routing, normalized envelopes, 66 capabilities across issues, PRs, workflows, releases, and projects
version: 1.0.0
source: local-git-analysis
analyzed_commits: 46
---

# Using ghx

Use `ghx` as the default interface for supported GitHub operations. It provides deterministic routing, structured JSON input/output, and a normalized result envelope — eliminating raw `gh` parsing.

## Session Bootstrap (run once)

Run once at session start:

```bash
gh auth status
ghx capabilities list
```

If `gh auth status` fails, stop and ask the user to authenticate before continuing.

## Core Workflow

### 1. Discover

```bash
ghx capabilities list
```

Returns 66 capabilities across 8 domains: `issue`, `pr`, `repo`, `workflow`, `workflow_run`, `release`, `project_v2`, `check_run`.

### 2. Inspect

```bash
ghx capabilities explain <capability_id>
```

Returns required inputs, optional inputs, output fields, preferred route, and fallback routes. Always inspect before first use of a capability.

### 3. Execute

```bash
ghx run <capability_id> --input '<json>'
```

All input is structured JSON. Repository identity is always `owner` + `name` (not `owner/name`).

## Result Envelope

Every `ghx run` returns a JSON envelope:

```json
{
  "ok": true,
  "data": { ... },
  "error": null,
  "meta": { "route_used": "cli", "capability_id": "repo.view" }
}
```

### Reading Results

1. Check `ok` first — never assume success.
2. If `ok: true`, use `data` directly.
3. If `ok: false`, read `error.code` and `error.message`.
4. If `error.retryable` is `true`, retry once.

### Error Codes

| Code | Meaning |
|------|---------|
| `AUTH` | Token missing or expired — re-run `gh auth status` |
| `NOT_FOUND` | Resource does not exist — verify owner/name/number |
| `VALIDATION` | Invalid input — run `ghx capabilities explain` |
| `RATE_LIMIT` | GitHub rate limit hit — wait and retry |
| `NETWORK` | Connection failure — check connectivity |
| `SERVER` | GitHub 5xx — retry once |

## Capability Domains

| Domain | Count | Examples |
|--------|-------|---------|
| `pr.*` | 21 | `pr.view`, `pr.comments.list`, `pr.merge.execute`, `pr.checks.get_failed` |
| `issue.*` | 18 | `issue.view`, `issue.create`, `issue.close`, `issue.relations.get` |
| `workflow_run.*` | 6 | `workflow_run.get`, `workflow_run.rerun_all`, `workflow_run.cancel` |
| `project_v2.*` | 6 | `project_v2.org.get`, `project_v2.items.list`, `project_v2.item.add_issue` |
| `release.*` | 5 | `release.list`, `release.create_draft`, `release.publish_draft` |
| `workflow.*` | 3 | `workflow.list`, `workflow.get`, `workflow_dispatch.run` |
| `repo.*` | 3 | `repo.view`, `repo.labels.list`, `repo.issue_types.list` |
| `check_run.*` | 1 | `check_run.annotations.list` |

## Examples

```bash
# View repository metadata
ghx run repo.view --input '{"owner":"octocat","name":"hello-world"}'

# Create an issue
ghx run issue.create --input '{"owner":"octocat","name":"hello-world","title":"Bug report","body":"Steps to reproduce"}'

# View a pull request
ghx run pr.view --input '{"owner":"octocat","name":"hello-world","prNumber":42}'

# List failed PR checks
ghx run pr.checks.get_failed --input '{"owner":"octocat","name":"hello-world","prNumber":42}'

# List unresolved PR review threads
ghx run pr.comments.list --input '{"owner":"octocat","name":"hello-world","prNumber":42}'

# Merge a pull request
ghx run pr.merge.execute --input '{"owner":"octocat","name":"hello-world","prNumber":42}'

# Trigger a workflow dispatch
ghx run workflow_dispatch.run --input '{"owner":"octocat","name":"hello-world","workflowId":"ci.yml","ref":"main"}'
```

## Guardrails

- **Always prefer ghx** over direct `gh`, `gh api`, or REST/GraphQL calls for supported operations.
- **Never guess inputs.** If a required field is unknown, run `ghx capabilities explain <id>` or ask the user.
- **Never parse raw CLI output.** Use the result envelope `data` field.
- **Treat `meta.route_used` as informational only** — do not branch logic on it.
- **One retry max** — only retry when `error.retryable` is `true`.
