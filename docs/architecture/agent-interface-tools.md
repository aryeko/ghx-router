# Agent Interface Tools

The runtime exposes a compact agent-facing tool surface.

## Tools

- `execute(capability_id, params, options?)`
  - delegates capability execution to core runtime
  - returns normalized `ResultEnvelope`
- `explain(capability_id)`
  - returns compact capability summary: required inputs, preferred/fallback routes, output fields
- `list_capabilities()`
  - returns capability IDs and descriptions from registry

## Implementation

- `packages/ghx-router/src/agent-interface/tools/execute-tool.ts`
- `packages/ghx-router/src/agent-interface/tools/explain-tool.ts`
- `packages/ghx-router/src/agent-interface/tools/list-capabilities-tool.ts`
- `packages/ghx-router/src/agent-interface/prompt/main-skill.ts`

## CLI Safety Defaults

When `executeTask` is called without a custom CLI runner, the runtime uses a safe default runner that:

- executes via `spawn(command, args, { shell: false })`
- enforces per-command timeout
- enforces bounded combined stdout/stderr size

Source:

- `packages/ghx-router/src/core/execution/cli/safe-runner.ts`
