---
"@ghx-dev/core": patch
---

Fix PR #60 review findings: register issue.assignees.add/remove GraphQL handlers, sweep expired cache entries before FIFO eviction, check response.ok before parsing JSON, extract buildLookupVars helper, pass strings directly to mapErrorToCode, and harden test coverage.
