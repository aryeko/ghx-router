---
"@ghx-dev/core": minor
---

Add structured JSONL execution logging. Emits typed log events at key points in the execution pipeline — preflight checks, route selection, adapter dispatch, all attempt failures (with `retryable` field), and results — written to `~/.ghx/logs/ghx-YYYY-MM-DD.jsonl`. Opt-in via `GHX_LOG_LEVEL` env var (debug/info/warn/error; unset = off). Log directory is configurable via `GHX_LOG_DIR`.
