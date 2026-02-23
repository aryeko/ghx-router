---
"@ghx-dev/core": patch
---

Fix `ghx chain` / `executeTasks` batch resolution aliasing bug.

`buildBatchQuery` aliases each GraphQL root field (e.g. `repository`) as `step0`, `step1`, etc. GitHub returns the value directly under the alias key with no wrapper. The engine was storing the unwrapped value, causing `applyInject` to fail when traversing inject paths like `repository.issue.id` in subsequent steps.

Fix: `extractRootFieldName()` is added to `batch.ts` and used in the Phase 1 un-alias loop to re-wrap the raw value as `{ [rootFieldName]: rawValue }` before storing it in `lookupResults`. Adds regression test using real batch/resolve implementations.
