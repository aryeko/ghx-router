---
"@ghx-dev/benchmark": minor
"@ghx-dev/core": patch
---

Benchmark updates:
- Add a config-driven benchmark suite runner workflow with paired mode execution, progress events,
  fixture setup/cleanup commands, and reporting/gating orchestration.
- Expand benchmark scenario coverage with seeded fixture bindings for issues, PRs, workflows,
  releases, and project-v2 flows, including fixture auth/bootstrap tooling.
- Harden fixture resolution and seeding behavior (safer manifest binding paths, check-run id
  handling, stricter CLI input validation), and improve dashboard rendering/progress semantics.
- Increase benchmark validation quality with broader schema/assertion checks and significantly
  expanded unit-test coverage across CLI, fixture, runner, and reporting modules.

Core updates:
- Extend CLI capability adapter coverage and handling for workflow id/input normalization and
  project-v2 item list normalization edge cases.
