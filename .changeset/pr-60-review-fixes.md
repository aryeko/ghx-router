---
"@ghx-dev/core": patch
---

Harden atomic chaining infrastructure based on review feedback:

- Register `issue.assignees.add`/`remove` GraphQL handlers (types, mutations, client, capability registry) — these capabilities now route via GraphQL instead of falling back to CLI
- Fix `GraphqlError.path` type to `ReadonlyArray<string | number>` per GraphQL spec
- Normalize `queryRaw` error handling — HTTP errors now settle consistently regardless of transport implementation
- Guard resolution cache against storing `undefined` and sweep expired entries before FIFO eviction
- Check `response.ok` before `response.json()` and wrap happy-path parse in try/catch for truncated responses
- Use strict `!== undefined` check for step errors instead of truthy check
- Extract `buildLookupVars` helper to eliminate duplication in engine
- Pass strings directly to `mapErrorToCode` instead of wrapping in `Error`
