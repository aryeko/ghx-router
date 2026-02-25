---
"@ghx-dev/core": patch
---

Fix bug where query-type capabilities (e.g. `issue.view`, `release.list`) would throw when used in a chain because `executeTasks` Phase 2 incorrectly called `getMutationDocument` for all GQL steps. Queries and mutations are now batched separately and executed in parallel.

Refactors the internal routing engine from a single 814-line file into a focused module tree (`engine/`) with clear phase separation: preflight, resolution, execute, and assemble. Adds explicit `operationType: query | mutation` to all operation cards.

Further cleans up the engine module architecture: unifies the `executeTask` / `executeTasks` entry points, extracts CLI step orchestration into `cli-dispatch.ts`, narrows `execute.ts` to GQL-only dispatch (`runGqlExecutePhase`), moves Phase 1 error recovery into `assembleResolutionFailure` in `assemble.ts`, and reduces `batch.ts` to a clean 86-line pipeline orchestrator.
