---
"@ghx-dev/core": patch
---

Add `--compact` flag to `capabilities list` for token-efficient agent discovery. Outputs capabilities as function signatures (e.g. `issue.view(owner,name,issueNumber)`) without descriptions, reducing output by ~3×. Destructive `.set` capabilities with a corresponding `.add` sibling are annotated with `[replaces all]`.
