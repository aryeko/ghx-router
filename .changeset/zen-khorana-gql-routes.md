---
"@ghx-dev/core": patch
---

Add GraphQL routes to 18 previously CLI-only capabilities across PR mutations, project_v2, release, and repo domains.

Capabilities upgraded to GraphQL-preferred (with CLI fallback):
- PR: `pr.assignees.add`, `pr.assignees.remove`, `pr.branch.update`, `pr.create`, `pr.merge`, `pr.reviews.request`, `pr.update`
- project_v2: `project_v2.fields.list`, `project_v2.items.field.update`, `project_v2.items.issue.add`, `project_v2.items.issue.remove`, `project_v2.items.list`, `project_v2.org.view`, `project_v2.user.view`
- release: `release.list`, `release.view`
- repo: `repo.issue_types.list`, `repo.labels.list`

Breaking changes:
- `project_v2.items.issue.add`: output changed from `{itemId, added: boolean}` to `{itemId, itemType: string|null}`
- `project_v2.items.issue.remove`: output changed from `{itemId, removed: boolean}` to `{deletedItemId: string}`
- `project_v2.items.field.update`: output changed from `{itemId, updated: boolean}` to `{itemId}`
- `pr.create`: `base` field is now required (was previously optional)
- `pr.update`: passing `draft` in any `pr.update` input now throws an error — the GraphQL route does not support draft changes; the engine automatically falls back to CLI
- `pr.merge`: passing `deleteBranch: true` triggers CLI fallback — the GraphQL mergePullRequest mutation does not support branch deletion
- `pr.assignees.add`, `pr.assignees.remove`: passing an empty array for assignees now throws a validation error
- `pr.reviews.request`: the `reviewers` output array no longer has a `minItems: 1` constraint — GraphQL may return zero reviewers after filtering
