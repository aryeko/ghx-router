# @ghx-dev/eval

## 0.2.0

### Minor Changes

- 85a4f6d: Add `@ghx-dev/eval` package.

  **`@ghx-dev/eval`** — new private eval harness that benchmarks the `ghx`, `mcp`, and `baseline` execution modes against live GitHub fixtures:

  - Config: YAML-driven `EvalConfig` with env-variable overrides (`PROFILER_REPETITIONS`, `PROFILER_MODES`, `EVAL_MODEL`, etc.)
  - Scenarios: JSON scenario files with fixture bindings, checkpoint assertions, and `{{variable}}` template substitution
  - Mode resolver: injects `ghx` binary + `SKILL.md`, GitHub MCP server, or plain `gh` CLI instructions per mode
  - Collector: classifies agent tool calls into six categories (`capabilities_used`, `mcp_tools_invoked`, `gh_cli_commands`, `bash_commands`, `file_ops`, `other_tools`)
  - Scorer: `CheckpointScorer` executes ghx capability tasks against live GitHub state and evaluates conditions (`non_empty`, `count_gte`, `field_equals`, etc.)
  - Provider: `OpenCodeProvider` drives isolated OpenCode sessions (per-session `XDG_CONFIG_HOME`) with 300 ms polling
  - Fixture manager: checks, resets (force-push to original SHA), and cleans up GitHub fixture resources between runs
  - CLI: `eval run`, `eval check`, `eval fixture seed/status/cleanup`, `eval report`, `eval analyze` commands
  - Full JSDoc on all public exports; `src/index.ts` exports all public types, schemas, classes, and functions

- cf7e8eb: Implement three missing eval features: fixture seeding with `--seed-id`/`--dry-run`/`--config` flags, `eval analyze` command wiring session traces to profiler analyzers, and `eval report` command generating reports from JSONL results.

### Patch Changes

- Updated dependencies [210404e]
- Updated dependencies [97b87a7]
- Updated dependencies [ad2ef11]
  - @ghx-dev/agent-profiler@0.1.0
  - @ghx-dev/core@0.2.2
