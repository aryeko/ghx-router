---
"@ghx-dev/core": patch
"@ghx-dev/benchmark": patch
---

Benchmark updates:
- Refactor suite execution by splitting mode-instruction, preflight, and prompt-rendering logic
  into focused runner modules.
- Align benchmark mode instructions and ghx preflight behavior, including stricter preflight
  checks for router readiness and fixture usage.
- Improve prompt rendering and output schema handling, including `pageInfo` compatibility.
- Add and update unit coverage for suite-runner, preflight, mode instruction, and prompt renderer
  paths.

Core updates:
- Adjust run-path routing behavior and CLI integration to align with benchmark runner updates.
- Refresh CLI/engine tests around run command flow and repository view behavior.
