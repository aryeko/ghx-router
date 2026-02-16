# File Codemap

**Last Updated:** 2026-02-16

## Repository Layout

```text
ghx/
├── .changeset/
├── docs/
│   ├── architecture/
│   ├── benchmark/
│   ├── engineering/
│   ├── guides/
│   └── CODEMAPS/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── agent-interface/
│   │   │   ├── cli/
│   │   │   ├── core/
│   │   │   ├── gql/
│   │   │   └── shared/
│   │   ├── scripts/
│   │   └── test/
│   └── benchmark/
│       ├── src/
│       │   ├── cli/
│       │   ├── domain/
│       │   ├── extract/
│       │   ├── report/
│       │   ├── runner/
│       │   └── scenario/
│       ├── scenarios/
│       ├── results/
│       ├── reports/
│       └── test/
├── .github/
│   ├── dependabot.yml
│   └── workflows/
├── .npmrc
├── biome.json
├── lefthook.yml
├── nx.json
├── package.json
└── pnpm-workspace.yaml
```

## Key Files by Area

### Workspace + Build System

- `package.json` - root scripts for build/format/lint/test/typecheck/benchmark
- `pnpm-workspace.yaml` - workspace package discovery (`packages/*`) + pnpm catalog for shared devDependencies
- `nx.json` - Nx task orchestration configuration
- `biome.json` - Biome formatter configuration (formatting + import sorting)
- `lefthook.yml` - pre-commit hooks (format, lint, typecheck)
- `.npmrc` - pnpm settings (`strict-peer-dependencies`, `auto-install-peers`)
- `.github/dependabot.yml` - automated dependency update PRs (npm + GitHub Actions)
- `.changeset/*.md` - release notes/versioning entries for publish flow
- `packages/core/tsup.config.ts` - core package build configuration
- `packages/benchmark/tsup.config.ts` - benchmark package build configuration

### Core Router Package (`packages/core`)

- `packages/core/src/index.ts` - package public exports for library consumers (`executeTask`, adapters, registry helpers)
- `packages/core/src/agent.ts` - package public agent-interface exports (`listCapabilities`, `createExecuteTool`)
- `packages/core/src/cli/index.ts` - `ghx` executable entrypoint
- `packages/core/src/cli/commands/run.ts` - task parsing + execution entry
- `packages/core/src/cli/commands/setup.ts` - setup/verify skill profile installation in `.agents/skills/ghx/SKILL.md`
- `packages/core/src/cli/assets/skills/ghx/` - bundled setup skill asset directory (contains canonical `SKILL.md`)
- `packages/core/src/cli/commands/capabilities-list.ts` - CLI capability list command
- `packages/core/src/cli/commands/capabilities-explain.ts` - CLI capability explain command
- `packages/core/src/cli/commands/doctor.ts` - diagnostics command scaffold (reserved)
- `packages/core/src/cli/commands/routes.ts` - route-inspection command scaffold (reserved)
- `packages/core/src/core/routing/engine.ts` - route selection + preflight orchestration
- `packages/core/src/core/execute/execute.ts` - route attempts, retry loop, schema validation
- `packages/core/src/core/registry/index.ts` - operation card loading/validation from YAML
- `packages/core/src/core/registry/cards/*.yaml` - source-of-truth capability cards
- `packages/core/src/core/contracts/tasks/*.ts` - per-capability task identifier constants
- `packages/core/src/core/execution/adapters/cli-capability-adapter.ts` - `gh` command mapping + output normalization
- `packages/core/src/core/execution/adapters/cli-adapter.ts` - generic CLI adapter primitive
- `packages/core/src/core/execution/adapters/graphql-capability-adapter.ts` - GraphQL capability adapter
- `packages/core/src/core/execution/adapters/graphql-adapter.ts` - generic GraphQL adapter primitive
- `packages/core/src/gql/client.ts` - typed GitHub GraphQL client + operation wrappers
- `packages/core/src/agent-interface/tools/list-capabilities-tool.ts` - capability listing tool for agents
- `packages/core/src/agent-interface/tools/explain-tool.ts` - capability schema/route explanation helper
- `packages/core/src/agent-interface/tools/execute-tool.ts` - capability execution wrapper for agent tooling
- `packages/core/README.md` - npm-facing package usage and API surface overview
- `packages/core/LICENSE` - package-level MIT license for publish artifacts

### Documentation

- `docs/guides/setup-command.md` - setup command behavior, scopes, verification flow, and team rollout guidance

### Benchmark Package (`packages/benchmark`)

- `packages/benchmark/src/cli/benchmark.ts` - benchmark run command
- `packages/benchmark/src/cli/args.ts` - argument parsing (`mode`, `repetitions`, `scenario`, `scenario-set`)
- `packages/benchmark/src/runner/suite-runner.ts` - end-to-end scenario execution orchestrator
- `packages/benchmark/src/scenario/schema.ts` - Zod scenario schema and validation
- `packages/benchmark/src/scenario/loader.ts` - scenario file loading
- `packages/benchmark/src/cli/check-scenarios.ts` - scenario set coverage and registry compatibility checks
- `packages/benchmark/scenario-sets.json` - explicit scenario set membership manifest
- `packages/benchmark/src/extract/envelope.ts` - envelope extraction and output checks
- `packages/benchmark/src/report/aggregate.ts` - summary metrics and gating logic
- `packages/benchmark/scenarios/*.json` - benchmark scenarios (task + assertions + fixtures)
- `packages/benchmark/results/*-suite.jsonl` - benchmark run outputs per mode
- `packages/benchmark/reports/latest-summary.json` - latest generated benchmark summary (JSON)
- `packages/benchmark/reports/latest-summary.md` - latest generated benchmark summary (markdown)

### Tests

- `packages/core/test/unit/*.test.ts` - unit tests for registry, adapters, router, CLI
- `packages/core/test/integration/*.integration.test.ts` - integration tests for end-to-end task execution paths
- `packages/benchmark/test/unit/*.test.ts` - benchmark parser, runner, and report tests

## Navigation Shortcuts

Use this path when debugging common concerns:

- **Route selection issue** -> `packages/core/src/core/routing/engine.ts`
- **Input/output schema failure** -> `packages/core/src/core/execute/execute.ts` and `packages/core/src/core/registry/schema-validator.ts`
- **Capability metadata mismatch** -> `packages/core/src/core/registry/cards/*.yaml`
- **Task identifier mapping mismatch** -> `packages/core/src/core/contracts/tasks/*.ts`
- **CLI command shape mismatch** -> `packages/core/src/core/execution/adapters/cli-capability-adapter.ts`
- **GraphQL payload/field mismatch** -> `packages/core/src/gql/client.ts` and `packages/core/src/gql/operations/*.generated.ts`
- **Benchmark scenario parse failure** -> `packages/benchmark/src/scenario/schema.ts`
- **Scenario-set coverage failure** -> `packages/benchmark/src/cli/check-scenarios.ts` and `packages/benchmark/scenario-sets.json`
- **Benchmark gate failure** -> `packages/benchmark/src/report/aggregate.ts`

## External Integrations (File-Level)

- GitHub GraphQL API: `packages/core/src/cli/commands/run.ts`
- GitHub CLI (`gh`): `packages/core/src/core/execution/adapters/cli-capability-adapter.ts`
- OpenCode SDK sessions: `packages/benchmark/src/runner/suite-runner.ts`
- JSON schema validation (AJV): `packages/core/src/core/registry/index.ts`, `packages/core/src/core/registry/schema-validator.ts`
- Scenario validation (Zod): `packages/benchmark/src/scenario/schema.ts`
