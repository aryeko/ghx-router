---
"@ghx-dev/core": patch
---

Add GQL handlers for issue.labels.remove and issue.milestone.clear.

Both capabilities had `routing.preferred: graphql` but no registered handler,
causing silent CLI fallback on every execution. This wires up the full chain:
domain function, GithubClient method, and capability-registry entry.
