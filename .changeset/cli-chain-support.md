---
"@ghx-dev/core": minor
---

Add CLI-routed capability support in chain execution (`executeTasks`). Steps whose operation card has a `cli` config but no `graphql` config are now dispatched concurrently via the CLI adapter alongside the GraphQL batch phases, rather than being rejected at pre-flight. The returned `meta.route_used` reflects `"cli"` when every step used the CLI adapter, and `"graphql"` for mixed or pure-GraphQL chains.
