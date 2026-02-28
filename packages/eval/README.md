# @ghx-dev/eval

Evaluation harness for ghx -- measures how structured capability routing compares to raw `gh` CLI and GitHub MCP server tools across tool calls, token cost, and reliability through unbiased, controlled benchmarks.

## How It Works

The eval package runs identical tasks across three execution modes and compares the results:

| Mode | Toolset | Agent sees |
|------|---------|------------|
| **ghx** | ghx capability router | Structured SKILL.md with typed capabilities |
| **mcp** | GitHub MCP server | MCP tool listing |
| **baseline** | Raw `gh` CLI | Standard CLI instructions |

Same agent, same model, same task, same starting GitHub state -- only the toolset changes. Statistical analysis (bootstrap CIs, Cohen's d, permutation tests) determines whether differences are real.

## Architecture

Built on `@ghx-dev/agent-profiler`, implementing 5 of its 6 plugin contracts:

| Contract | Eval Implementation | Purpose |
|----------|-------------------|---------|
| SessionProvider | `OpenCodeProvider` | Drive agent sessions via OpenCode SDK |
| Scorer | `CheckpointScorer` | Verify agent work via ghx capabilities |
| Collector | `GhxCollector` | Classify tool calls into 6 categories |
| ModeResolver | `EvalModeResolver` | Configure ghx/mcp/baseline environments |
| RunHooks | `createEvalHooks` | Reset fixtures between iterations |

## Quick Start

```bash
# From the monorepo root
pnpm install

# Run an evaluation
pnpm --filter @ghx-dev/eval run eval run \
  --mode ghx \
  --scenario pr-review-comment-001 \
  --repetitions 3
```

## Key Exports

```typescript
// Config
import { loadEvalConfig, EvalConfigSchema } from "@ghx-dev/eval"
import type { EvalConfig } from "@ghx-dev/eval"

// Scenarios
import { loadEvalScenarios, loadScenarioSets, bindFixtureVariables, EvalScenarioSchema } from "@ghx-dev/eval"
import type { EvalScenario, CheckpointCondition } from "@ghx-dev/eval"

// Fixtures
import { FixtureManager, loadFixtureManifest, writeFixtureManifest } from "@ghx-dev/eval"
import type { FixtureManifest } from "@ghx-dev/eval"

// Execution
import { OpenCodeProvider, EvalModeResolver, CheckpointScorer, GhxCollector, createEvalHooks } from "@ghx-dev/eval"
import type { EvalHooksOptions } from "@ghx-dev/eval"
```

## Documentation

Full documentation: [docs/](./docs/)

- [Methodology](./docs/methodology/README.md) -- Thesis, evaluation design, metrics, interpreting results
- [Getting Started](./docs/getting-started/README.md) -- Installation, quick start, core concepts
- [Architecture](./docs/architecture/README.md) -- System design, plugin implementations, modes, fixtures
- [Guides](./docs/guides/README.md) -- Writing scenarios, configuration, CLI usage, custom collectors
- [API Reference](./docs/api/README.md) -- Type reference and public API surface
- [Contributing](./docs/contributing/README.md) -- Development setup, adding scenarios

## Requirements

- Node.js 22+
- pnpm workspace (monorepo)
- `GITHUB_TOKEN` or `GH_TOKEN` environment variable

## License

See repository root for license information.
