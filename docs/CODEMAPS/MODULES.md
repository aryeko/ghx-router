# Module Codemap

**Last Updated:** 2026-02-14

## Core Package (`packages/core/src`)

### Routing Engine

**Purpose**: Selects execution routes and coordinates fallback/retry behavior.  
**Location**: `packages/core/src/core/routing/`

| Module | Purpose | Key Exports | Depends On |
|---|---|---|---|
| `engine.ts` | Main task execution coordinator | `chooseRoute()`, `executeTask()` | `core/execute`, `execution/adapters/*`, `registry`, `gql/client` |
| `policy.ts` | Route preference ordering | `routePreferenceOrder` | none |
| `reason-codes.ts` | Route reason taxonomy | `routeReasonCodes`, `RouteReasonCode` | none |
| `capability-registry.ts` | Registry view of cards | `capabilityRegistry` | `core/registry/index.ts` |

### Operation Registry

**Purpose**: Loads and validates capability cards from YAML at runtime.  
**Location**: `packages/core/src/core/registry/`

| Module | Purpose | Key Exports | Depends On |
|---|---|---|---|
| `index.ts` | Card loader + lookup | `validateOperationCard()`, `listOperationCards()`, `getOperationCard()` | `ajv`, `js-yaml`, `operation-card-schema` |
| `types.ts` | Card and routing type contracts | `OperationCard`, `SuitabilityRule` | `contracts/envelope` |
| `schema-validator.ts` | JSON schema validation wrappers | `validateInput()`, `validateOutput()` | `ajv` |
| `operation-card-schema.ts` | AJV-compatible card schema | `operationCardSchema` | none |

### Execution Pipeline

**Purpose**: Validates input/output, executes per-route handlers, tracks attempts.  
**Location**: `packages/core/src/core/execute/` and `packages/core/src/core/execution/`

| Module | Purpose | Key Exports | Depends On |
|---|---|---|---|
| `execute/execute.ts` | Route plan + retry loop + output validation | `execute()` | `schema-validator`, `normalizer`, `telemetry/logger` |
| `execution/preflight.ts` | Route readiness checks | `preflightCheck()` | `errors/codes` |
| `execution/normalizer.ts` | Envelope normalization helpers | `normalizeResult()`, `normalizeError()` | `contracts/envelope` |
| `execution/adapters/cli-capability-adapter.ts` | Capability-to-`gh` command adapter | `runCliCapability()`, `CliCapabilityId` | `errors`, `normalizer` |
| `execution/adapters/graphql-capability-adapter.ts` | Capability-to-GitHub GraphQL adapter | `runGraphqlCapability()`, `GraphqlCapabilityId` | `gql/client`, `errors`, `normalizer` |
| `execution/adapters/rest-adapter.ts` | Placeholder REST adapter | `runRestAdapter()` | none |
| `execution/cli/safe-runner.ts` | Safe process spawn wrapper for `gh` | `createSafeCliCommandRunner()` | `node:child_process` |

### Contracts and Error Taxonomy

**Purpose**: Defines stable envelope + task + error contracts.  
**Location**: `packages/core/src/core/contracts/` and `packages/core/src/core/errors/`

| Module | Purpose | Key Exports | Depends On |
|---|---|---|---|
| `contracts/envelope.ts` | Stable router output shape | `ResultEnvelope`, `RouteSource` | `routing/reason-codes`, `errors/codes` |
| `contracts/task.ts` | Input task contract | `TaskRequest` | none |
| `errors/codes.ts` | Canonical error code list | `errorCodes`, `ErrorCode` | none |
| `errors/map-error.ts` | Error classification mapping | `mapErrorToCode()` | `errors/codes` |
| `errors/retryability.ts` | Retry policy by error code | `isRetryableErrorCode()` | `errors/codes` |

### GraphQL Client Layer

**Purpose**: Typed GitHub GraphQL facade and normalization for capability consumers.  
**Location**: `packages/core/src/gql/`

| Module | Purpose | Key Exports | Depends On |
|---|---|---|---|
| `client.ts` | Typed GraphQL client + GitHub domain fetchers | `createGraphqlClient()`, `createGithubClient()`, `GithubClient` | generated operation SDKs, `graphql`, `graphql-request` |
| `operations/*.generated.ts` | Generated operation SDK wrappers | operation-specific `getSdk()` + query types | codegen output |
| `generated/common-types.ts` | shared generated scalar/type aliases | scalar + operation support types | codegen output |

### CLI + Agent Interface

**Purpose**: Human/agent entrypoints and helper tools to interact with capabilities.  
**Location**: `packages/core/src/cli/` and `packages/core/src/agent-interface/`

| Module | Purpose | Key Exports | Depends On |
|---|---|---|---|
| `cli/index.ts` | CLI command router (`ghx run`) | `main()` | `cli/commands/run` |
| `cli/commands/run.ts` | Parses args + invokes execution engine | `runCommand()` | `gql/client`, `routing/engine` |
| `agent-interface/tools/list-capabilities-tool.ts` | Exposes card list to agents | `listCapabilities()` | `registry/index` |
| `agent-interface/tools/execute-tool.ts` | Wraps `executeTask` for agent tool calls | `createExecuteTool()` | `contracts/envelope` |
| `agent-interface/prompt/main-skill.ts` | Prompt guardrails for agent usage | `MAIN_SKILL_TEXT` | none |

## Benchmark Package (`packages/benchmark/src`)

### Scenario + Domain Layer

**Purpose**: Defines scenario schema/contracts and loads test fixtures.  
**Location**: `packages/benchmark/src/scenario/` and `packages/benchmark/src/domain/`

| Module | Purpose | Key Exports | Depends On |
|---|---|---|---|
| `domain/types.ts` | Benchmark row + scenario + message types | `BenchmarkMode`, `Scenario`, `BenchmarkRow`, etc. | none |
| `scenario/schema.ts` | Zod scenario validation | `validateScenario()` | `zod`, `domain/types` |
| `scenario/loader.ts` | Filesystem loader for scenario JSON | `loadScenarios()` | `scenario/schema` |

### Runner + Extraction Layer

**Purpose**: Executes sessions and turns outputs into validated benchmark rows.  
**Location**: `packages/benchmark/src/runner/` and `packages/benchmark/src/extract/`

| Module | Purpose | Key Exports | Depends On |
|---|---|---|---|
| `runner/suite-runner.ts` | Main orchestrator for scenarios/retries/output files | `runSuite()`, `runScenario()`, `renderPrompt()` | OpenCode SDK, scenario loader, extraction modules |
| `extract/envelope.ts` | JSON envelope extraction + assertions | `extractFirstJsonObject()`, `validateEnvelope()` | `domain/types` |
| `extract/attempts.ts` | Retry/attempt metric extraction | `extractAttemptMetrics()` | none |
| `extract/tool-usage.ts` | Tool call aggregation from message parts | `aggregateToolCounts()` | `domain/types` |

### Reporting + CLIs

**Purpose**: Produces summaries and quality gates from benchmark rows.  
**Location**: `packages/benchmark/src/report/` and `packages/benchmark/src/cli/`

| Module | Purpose | Key Exports | Depends On |
|---|---|---|---|
| `report/aggregate.ts` | Per-mode summaries and gate checks | `buildSummary()`, `toMarkdown()` | `domain/types` |
| `cli/benchmark.ts` | Bench run command entrypoint | `main()` | `cli/args`, `runner/suite-runner` |
| `cli/check-scenarios.ts` | Scenario validation command | `main()` | `scenario/loader` |
| `cli/report.ts` | Report and gate CLI | `main()` | `report/aggregate` |
