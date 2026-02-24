---
"@ghx-dev/core": patch
---

Add CLI-routed capability support in chain execution (`executeTasks`). Steps whose operation card has a `cli` config but no `graphql` config are now dispatched concurrently via the CLI adapter alongside the GraphQL batch phases, rather than being rejected at pre-flight. The returned `meta.route_used` reflects `"cli"` when every step used the CLI adapter, and `"graphql"` for mixed or pure-GraphQL chains.

When Phase 1 (GraphQL resolution) fails, concurrent CLI steps that already completed are preserved in the result rather than discarded — the chain returns `partial` status instead of unconditionally failing all steps. Invariant guard violations in the CLI dispatch and drain loops now throw rather than silently skipping steps.
