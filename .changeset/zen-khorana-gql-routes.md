---
"@ghx-dev/core": minor
---

Add GraphQL routes to 19 previously CLI-only capabilities across PR mutations, project_v2, release, and repo domains.

Breaking changes:
- `project_v2.items.issue.add`: output changed from `{itemId, added: boolean}` to `{itemId, itemType: string|null}`
- `project_v2.items.issue.remove`: output changed from `{itemId, removed: boolean}` to `{deletedItemId: string}`
- `project_v2.items.field.update`: output changed from `{itemId, updated: boolean}` to `{itemId}`
- `pr.create`: `base` field is now required (was previously optional)
- `pr.update`: passing `draft` as the sole update field now throws an error — the GraphQL route does not support draft-only updates
- `pr.merge`: passing `deleteBranch: true` now throws an error — the GraphQL mergePullRequest mutation does not support branch deletion
