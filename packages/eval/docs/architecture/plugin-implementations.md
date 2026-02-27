# Plugin Implementations

`@ghx-dev/eval` implements 5 of the 6 profiler plugin contracts. The profiler provides built-in collectors and analyzers; eval adds ghx-specific implementations that connect the generic profiling framework to GitHub task evaluation.

## Implementation Table

| Profiler Contract | Eval Implementation | Source | Responsibility |
|-------------------|---------------------|--------|----------------|
| `SessionProvider` | `OpenCodeProvider` | `src/provider/opencode-provider.ts` | Drive agent sessions via OpenCode SDK with polling-based completion detection |
| `Scorer` | `CheckpointScorer` | `src/scorer/checkpoint-scorer.ts` | Verify task correctness by running ghx capability calls and evaluating conditions |
| `Collector` | `GhxCollector` | `src/collector/ghx-collector.ts` | Classify tool calls into ghx/mcp/gh_cli/bash/file_ops/other categories |
| `ModeResolver` | `EvalModeResolver` | `src/mode/resolver.ts` | Map mode names to environment variables, system instructions, and MCP config |
| `RunHooks` | `createEvalHooks()` | `src/hooks/eval-hooks.ts` | Fixture verification, reset, and session trace export |

The 6th contract (`Analyzer`) is not implemented by eval -- the profiler's 5 built-in analyzers (Reasoning, Strategy, Efficiency, ToolPattern, Error) are used directly.

## Boundary Crossing Pattern

`EvalScenario` extends the profiler's `BaseScenario` with additional fields for GitHub-specific evaluation: `category`, `difficulty`, `fixture`, and `assertions`. The profiler's runner accepts scenarios typed as `BaseScenario` and passes them through to consumer-side components unchanged. This works because:

1. `EvalScenario` includes all `BaseScenario` fields (`id`, `name`, `description`, `prompt`, `timeoutMs`, `allowedRetries`, `tags`) plus the eval-specific additions (`category`, `difficulty`, `fixture`, `assertions`).
2. The profiler receives scenarios typed as `BaseScenario` and forwards them without stripping properties.
3. Consumer-side components (scorer, collector, hooks) type-narrow back to `EvalScenario` via a cast on the scenario from context.
4. Extra properties survive at runtime due to TypeScript's structural type system -- the profiler never serializes or reconstructs the scenario objects.

The narrowing pattern appears consistently across eval's plugin implementations:

```typescript
// In CheckpointScorer
const scenario = ctx.scenario as EvalScenario
const checkpoints = scenario.assertions.checkpoints
```

The same cast is used in `createEvalHooks()` to access `scenario.fixture.reseedPerIteration` and in `GhxCollector` when trace-level context is needed. This is a deliberate design choice -- the profiler remains domain-agnostic while eval's components recover full type information at the boundaries where they need it.

## SessionProvider -- OpenCodeProvider

`OpenCodeProvider` manages the full lifecycle of an AI agent session through the OpenCode SDK. It starts an OpenCode server, creates isolated sessions with separate `XDG_CONFIG_HOME` directories, sends prompts, polls for completion, extracts token/timing/tool-call metrics from responses, and builds session traces via `TraceBuilder`. See [OpenCode Provider](./opencode-provider.md) for the complete architecture.

## Scorer -- CheckpointScorer

`CheckpointScorer` evaluates whether the agent actually accomplished its task by running ghx capability calls against live GitHub state. For each checkpoint in the scenario's `assertions.checkpoints` array, it calls `executeTask()` from `@ghx-dev/core` with the checkpoint's `task` and `input`, then evaluates the result against the checkpoint's `condition`. All checkpoints must pass for the scenario to be marked successful.

The scorer supports seven condition types: `non_empty`, `empty`, `count_gte`, `count_eq`, `field_equals`, `field_contains`, and `custom` (v2, not yet implemented). Each condition operates on the `data` field of the `ResultEnvelope` returned by `executeTask()`.

## Collector -- GhxCollector

`GhxCollector` classifies every tool call from an agent session into one of six categories and emits each as a custom metric on the `ProfileRow`:

- **ghx** -- tool names starting with `ghx`, `ghx.`, or `ghx_`
- **mcp** -- tool names starting with `github_`, `mcp_`, or `mcp__`
- **gh_cli** -- bash tool calls where the command starts with `gh`
- **bash** -- general bash/shell executions (excluding gh CLI)
- **file_ops** -- file read/write/edit/list operations
- **other** -- uncategorized tool calls

The collector prefers trace events over `PromptResult.metrics.toolCalls` because trace events carry the tool input, enabling accurate `gh_cli` detection within bash commands.

## ModeResolver -- EvalModeResolver

`EvalModeResolver` maps the three mode names (`ghx`, `mcp`, `baseline`) to `ModeConfig` objects containing environment variables, system instructions, and provider overrides. See [Modes](./modes.md) for the full mode comparison.

## RunHooks -- createEvalHooks()

The `createEvalHooks()` factory wires fixture management and session export into the profiler's run lifecycle:

- **`beforeRun`** -- verifies all required fixtures exist in the manifest; throws with missing fixture names if any are absent
- **`beforeScenario`** -- resets fixtures to their original state when `fixture.reseedPerIteration` is `true`
- **`afterScenario`** -- persists the session trace to `reports/sessions/<scenarioId>/<mode>-iter-<n>.json` when session export is enabled

See [Fixtures](./fixtures.md) for the full fixture lifecycle.

**Source:** `packages/eval/src/provider/opencode-provider.ts`, `packages/eval/src/scorer/checkpoint-scorer.ts`, `packages/eval/src/collector/ghx-collector.ts`, `packages/eval/src/mode/resolver.ts`, `packages/eval/src/hooks/eval-hooks.ts`

## Related Documentation

- [Plugin Contracts (profiler)](../../../agent-profiler/docs/architecture/plugin-contracts.md)
- [System Overview](./overview.md)
- [Modes](./modes.md)
- [Fixtures](./fixtures.md)
- [Scenarios](./scenarios.md)
- [OpenCode Provider](./opencode-provider.md)
