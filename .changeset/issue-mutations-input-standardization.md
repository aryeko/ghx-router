---
"@ghx-dev/core": minor
---

Standardize all issue mutation capabilities to accept `{ owner, name, issueNumber }` instead of `{ issueId }`.

**Breaking input change** for: `issue.close`, `issue.reopen`, `issue.delete`, `issue.update`, `issue.labels.set`, `issue.labels.add`, `issue.labels.remove`, `issue.assignees.set`, `issue.assignees.add`, `issue.assignees.remove`, `issue.milestone.set`, `issue.comments.create`.

Each capability now resolves the GitHub node ID internally via a Phase 1 lookup before executing the Phase 2 mutation. This matches the input contract of `issue.view` and enables `ResolutionCache` hits when capabilities are chained together in `executeTasks` calls.
