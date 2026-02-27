# Plugin Contracts

> Back to [main design](./README.md)

---

## Overview

The profiler defines six plugin contracts that consumers implement. These
interfaces are the sole coupling between `@ghx-dev/agent-profiler` and
consumer packages like `@ghx-dev/eval`.

---

## 1. SessionProvider

The primary plugin. Manages agent session lifecycle -- creating sessions,
sending prompts, waiting for completion, and exporting session traces.

```typescript
interface SessionProvider {
  /** Unique identifier for this provider (e.g., "opencode", "claude-sdk") */
  readonly id: string

  /** Initialize the provider (start server, establish connection) */
  init(config: ProviderConfig): Promise<void>

  /** Create a new isolated session for one profiling iteration */
  createSession(params: CreateSessionParams): Promise<SessionHandle>

  /** Send a prompt and wait for the agent to complete its turn */
  prompt(
    handle: SessionHandle,
    text: string,
    timeoutMs?: number,
  ): Promise<PromptResult>

  /** Export the full session trace for analysis */
  exportSession(handle: SessionHandle): Promise<SessionTrace>

  /** Tear down a specific session */
  destroySession(handle: SessionHandle): Promise<void>

  /** Shut down the provider (stop server, clean up resources) */
  shutdown(): Promise<void>
}

interface ProviderConfig {
  /** Port for the agent server (if applicable) */
  readonly port: number
  /** Model identifier */
  readonly model: string
  /** Current execution mode */
  readonly mode: string
  /** Permission configuration for the agent */
  readonly permissions: PermissionConfig
  /** Environment variables to inject */
  readonly environment: Readonly<Record<string, string>>
  /** Working directory for the agent */
  readonly workdir: string
}

interface PermissionConfig {
  /** Allow all tool calls without confirmation */
  readonly autoApprove: boolean
  /** Specific tools to auto-approve */
  readonly allowedTools: readonly string[]
}

interface CreateSessionParams {
  /** System instructions for the agent */
  readonly systemInstructions: string
  /** Scenario identifier (for labeling) */
  readonly scenarioId: string
  /** Iteration number (for labeling) */
  readonly iteration: number
}

interface SessionHandle {
  /** Unique session identifier from the provider */
  readonly sessionId: string
  /** Provider identifier */
  readonly provider: string
  /** ISO timestamp of session creation */
  readonly createdAt: string
}
```

### PromptResult

Returned by `prompt()` with immediate per-turn metrics:

```typescript
interface PromptResult {
  /** Agent's text response */
  readonly text: string

  /** Metrics extracted from this turn */
  readonly metrics: {
    readonly tokens: TokenBreakdown
    readonly timing: TimingBreakdown
    readonly toolCalls: readonly ToolCallRecord[]
    readonly cost: CostBreakdown
  }

  /** Why the turn ended */
  readonly completionReason: "stop" | "timeout" | "error" | "tool_limit"
}
```

### SessionTrace

Returned by `exportSession()` for deep analysis:

```typescript
interface SessionTrace {
  readonly sessionId: string
  readonly events: readonly TraceEvent[]
  readonly turns: readonly Turn[]
  readonly summary: {
    readonly totalTurns: number
    readonly totalToolCalls: number
    readonly totalTokens: TokenBreakdown
    readonly totalDuration: number
  }
}
```

See [metrics.md](./metrics.md) for `TokenBreakdown`, `TimingBreakdown`, etc.
See [analysis.md](./analysis.md) for `TraceEvent` and `Turn` types.

---

## 2. Scorer

Evaluates whether the agent completed the task correctly. The profiler does not
define what "correct" means -- that is entirely up to the consumer.

```typescript
interface Scorer {
  /** Unique identifier for this scorer */
  readonly id: string

  /** Evaluate task completion */
  evaluate(
    scenario: BaseScenario,
    context: ScorerContext,
  ): Promise<ScorerResult>
}

interface ScorerContext {
  /** The agent's final text output */
  readonly agentOutput: string
  /** Full session trace (if available) */
  readonly trace: SessionTrace | null
  /** Current mode being evaluated */
  readonly mode: string
  /** Current model being evaluated */
  readonly model: string
  /** Iteration number */
  readonly iteration: number
  /** Consumer-provided extra context */
  readonly metadata: Readonly<Record<string, unknown>>
}

interface ScorerResult {
  /** Overall pass/fail */
  readonly success: boolean
  /** Number of checks that passed */
  readonly passed: number
  /** Total number of checks */
  readonly total: number
  /** Per-check details */
  readonly details: readonly ScorerCheckResult[]
  /** Whether the agent output is valid (format, completeness) */
  readonly outputValid: boolean
  /** Error message if evaluation itself failed */
  readonly error?: string
}

interface ScorerCheckResult {
  readonly id: string
  readonly description: string
  readonly passed: boolean
  readonly actual?: unknown
  readonly expected?: unknown
  readonly error?: string
}
```

### Future: LLM-as-a-Judge Scorer

The `Scorer` interface supports LLM-based evaluation as a future extension.
An `LlmJudgeScorer` would use an LLM to evaluate agent trajectories against
natural language rubrics, complementing deterministic checkpoint scorers:

```typescript
// Example future implementation (not in initial release)
class LlmJudgeScorer implements Scorer {
  readonly id = "llm-judge"

  async evaluate(scenario: BaseScenario, context: ScorerContext): Promise<ScorerResult> {
    // 1. Build a prompt with the scenario description, agent trajectory, and rubric
    // 2. Ask an LLM to evaluate on dimensions:
    //    - Task success (pass/fail with rationale)
    //    - Trajectory efficiency (1-5 scale: did the agent take an optimal path?)
    // 3. Parse structured LLM output into ScorerResult
  }
}
```

This is useful for scenarios where success is hard to define deterministically
(e.g., "was the review comment constructive?") or where you want a qualitative
assessment of the agent's problem-solving approach. Libraries like `autoevals`
(Braintrust) or `@langchain/agentevals` can be wrapped inside this scorer.

---

## 3. Collector

Extracts custom metrics beyond the built-in token/latency/tool/cost metrics.
Consumers use collectors to capture domain-specific measurements.

```typescript
interface Collector {
  /** Unique identifier for this collector */
  readonly id: string

  /** Extract custom metrics from a prompt result */
  collect(
    result: PromptResult,
    scenario: BaseScenario,
    mode: string,
  ): Promise<readonly CustomMetric[]>
}

interface CustomMetric {
  /** Metric name (namespaced, e.g., "ghx.capabilities_used") */
  readonly name: string
  /** Metric value (number for aggregation, string for labels) */
  readonly value: number | string
  /** Unit label (e.g., "count", "ms", "USD") */
  readonly unit: string
}
```

Custom metrics are stored in `ProfileRow.extensions` and included in reports.

---

## 4. Analyzer

Processes session traces to produce qualitative insights about agent behavior.
The profiler ships five built-in analyzers (see [analysis.md](./analysis.md))
but consumers can add domain-specific ones.

```typescript
interface Analyzer {
  /** Unique identifier (e.g., "reasoning", "tool-patterns") */
  readonly name: string

  /** Analyze a single session trace */
  analyze(
    trace: SessionTrace,
    scenario: BaseScenario,
    mode: string,
  ): AnalysisResult
}

interface AnalysisResult {
  /** Analyzer name */
  readonly analyzer: string
  /** Key-value findings */
  readonly findings: Readonly<Record<string, AnalysisFinding>>
  /** Free-text summary */
  readonly summary: string
}

type AnalysisFinding =
  | { readonly type: "number"; readonly value: number; readonly unit: string }
  | { readonly type: "string"; readonly value: string }
  | { readonly type: "list"; readonly values: readonly string[] }
  | { readonly type: "table"; readonly headers: readonly string[]; readonly rows: readonly (readonly string[])[] }
  | { readonly type: "ratio"; readonly value: number; readonly label: string }
```

---

## 5. ModeResolver

Maps mode names to environment configurations. The profiler iterates over mode
names; the resolver translates each mode into the concrete environment the
provider needs.

```typescript
interface ModeResolver {
  /** Resolve a mode name into provider environment configuration */
  resolve(mode: string): Promise<ModeConfig>
}

interface ModeConfig {
  /** Environment variables to set for this mode */
  readonly environment: Readonly<Record<string, string>>
  /** System instructions specific to this mode */
  readonly systemInstructions: string
  /** Additional provider config overrides */
  readonly providerOverrides: Readonly<Record<string, unknown>>
}
```

---

## 6. RunHooks

Optional lifecycle callbacks for setup/teardown around scenarios and modes.
Consumers use hooks for fixture management, session export, logging, etc.

```typescript
type RunHooks = {
  /** Called before each scenario iteration starts */
  readonly beforeScenario?: (ctx: BeforeScenarioContext) => Promise<void>

  /** Called after each scenario iteration completes */
  readonly afterScenario?: (ctx: AfterScenarioContext) => Promise<void>

  /** Called before switching to a new mode */
  readonly beforeMode?: (mode: string) => Promise<void>

  /** Called after all iterations for a mode complete */
  readonly afterMode?: (mode: string) => Promise<void>

  /** Called once before the entire run starts */
  readonly beforeRun?: (ctx: RunContext) => Promise<void>

  /** Called once after the entire run completes */
  readonly afterRun?: (ctx: RunContext) => Promise<void>
}

interface BeforeScenarioContext {
  readonly scenario: BaseScenario
  readonly mode: string
  readonly model: string
  readonly iteration: number
}

interface AfterScenarioContext extends BeforeScenarioContext {
  readonly result: ProfileRow
  readonly trace: SessionTrace | null
}

interface RunContext {
  readonly runId: string
  readonly modes: readonly string[]
  readonly scenarios: readonly BaseScenario[]
  readonly repetitions: number
}
```

---

## Contract Summary

```
Consumer Package (e.g., @ghx-dev/eval)
    |
    |  implements
    |
    v
+---------------------------------------------------+
|              @ghx-dev/agent-profiler               |
|                                                    |
|  SessionProvider  <-- drives agent sessions        |
|  Scorer           <-- evaluates correctness        |
|  Collector        <-- extracts custom metrics      |
|  Analyzer         <-- adds domain analysis         |
|  ModeResolver     <-- maps modes to environments   |
|  RunHooks         <-- lifecycle callbacks           |
|                                                    |
|  ProfileRunner    --> orchestrates everything       |
|  Stats Engine     --> computes aggregates           |
|  Reporter         --> generates report pages        |
+---------------------------------------------------+
```
