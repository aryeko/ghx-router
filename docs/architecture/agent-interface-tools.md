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
