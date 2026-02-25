---
"@ghx-dev/core": patch
---

Fix `buildBatchQuery` dropping fragment definitions in chained GQL queries.

When `ghx chain` batched multiple GQL query steps into a single `BatchChain` document,
fragment definitions (e.g. `PrCoreFields`, `PageInfoFields`) were stripped out while
`...FragmentName` spread references remained in the body. GitHub's API rejected the
request with "Fragment X was used, but not defined".

`buildBatchMutation` already handled fragments correctly; `buildBatchQuery` now mirrors
the same deduplicating fragment-collection logic.
