# Public API

All public exports from `@ghx-dev/eval`, organized by category.

## Config

```typescript
import { loadEvalConfig, EvalConfigSchema } from "@ghx-dev/eval"
import type { EvalConfig } from "@ghx-dev/eval"
```

| Export | Kind | Description |
|--------|------|-------------|
| `loadEvalConfig` | function | Loads and validates an eval configuration file |
| `EvalConfigSchema` | Zod schema | Runtime validator for `EvalConfig` |
| `EvalConfig` | type | Configuration shape for eval suite runs |

## Scenarios

```typescript
import {
  loadEvalScenarios,
  loadScenarioSets,
  bindFixtureVariables,
  EvalScenarioSchema,
} from "@ghx-dev/eval"
import type { EvalScenario, CheckpointCondition } from "@ghx-dev/eval"
```

| Export | Kind | Description |
|--------|------|-------------|
| `loadEvalScenarios` | function | Loads and validates scenario files from a directory |
| `loadScenarioSets` | function | Loads named scenario sets for grouping and filtering |
| `bindFixtureVariables` | function | Replaces `{{variable}}` placeholders in scenario inputs with fixture manifest values |
| `EvalScenarioSchema` | Zod schema | Runtime validator for `EvalScenario` |
| `EvalScenario` | type | Eval scenario definition (see [EvalScenario Reference](./eval-scenario.md)) |
| `CheckpointCondition` | type | Discriminated union of checkpoint condition types (see [Conditions Reference](./checkpoint-conditions.md)) |

## Fixtures

```typescript
import { FixtureManager, loadFixtureManifest, writeFixtureManifest } from "@ghx-dev/eval"
import type { FixtureManifest } from "@ghx-dev/eval"
```

| Export | Kind | Description |
|--------|------|-------------|
| `FixtureManager` | class | Manages GitHub fixture lifecycle: seeding, resetting, and cleanup |
| `loadFixtureManifest` | function | Reads and validates a fixture manifest JSON file |
| `writeFixtureManifest` | function | Serializes a fixture manifest to a JSON file |
| `FixtureManifest` | type | Describes fixture resources for a seed run (see [Fixture Manifest Reference](./fixture-manifest.md)) |

## Execution

```typescript
import {
  OpenCodeProvider,
  EvalModeResolver,
  CheckpointScorer,
  GhxCollector,
  createEvalHooks,
} from "@ghx-dev/eval"
import type { EvalHooksOptions } from "@ghx-dev/eval"
```

| Export | Kind | Description |
|--------|------|-------------|
| `OpenCodeProvider` | class | `SessionProvider` implementation that drives agent sessions via OpenCode |
| `EvalModeResolver` | class | `ModeResolver` implementation that resolves eval-specific mode configurations |
| `CheckpointScorer` | class | `Scorer` implementation that evaluates checkpoints against live GitHub state |
| `GhxCollector` | class | `Collector` implementation that captures ghx-specific telemetry during sessions |
| `createEvalHooks` | function | Factory for `RunHooks` that handle fixture seeding, resetting, and cleanup |
| `EvalHooksOptions` | type | Options for configuring `createEvalHooks` behavior |

All execution classes implement plugin contracts from `@ghx-dev/agent-profiler`: `SessionProvider`, `ModeResolver`, `Scorer`, `Collector`, and `RunHooks`.

Source: `packages/eval/src/index.ts`

## Related Documentation

- [EvalScenario Type Reference](./eval-scenario.md)
- [Checkpoint Conditions](./checkpoint-conditions.md)
- [Fixture Manifest](./fixture-manifest.md)
- [Architecture Overview](../architecture/overview.md)
- [Quick Start](../getting-started/quick-start.md)
