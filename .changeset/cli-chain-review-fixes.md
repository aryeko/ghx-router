---
"@ghx-dev/core": patch
---

Fix code review findings in CLI chain support: replace sequential CLI result collection with `Promise.allSettled` for true concurrency and safe rejection handling; compute `meta.route_used` dynamically on pre-flight failures instead of hardcoding `"graphql"`; add clarifying comments to the CLI dispatch guard and route assignment.
