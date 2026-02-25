---
"@ghx-dev/core": patch
---

Compact output by default for `ghx run` and `ghx chain`. Strips `meta`, `error.retryable`, `error.details`, and per-step `data` from chain success steps. Add `--verbose` to restore full envelope output.
