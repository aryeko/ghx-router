import type { ProfileRow } from "../types/profile-row.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"

/** Context passed to the beforeScenario hook before each iteration begins. */
export interface BeforeScenarioContext {
  /** The scenario about to be executed. */
  readonly scenario: BaseScenario
  /** The execution mode for this iteration. */
  readonly mode: string
  /** The model identifier for this iteration. */
  readonly model: string
  /** Zero-based repetition index. */
  readonly iteration: number
}

/** Context passed to the afterScenario hook after each iteration completes. */
export interface AfterScenarioContext extends BeforeScenarioContext {
  /** The profile row produced by the completed iteration. */
  readonly result: ProfileRow
  /** The session trace, or null if export was disabled or the iteration failed. */
  readonly trace: SessionTrace | null
}

/** Context passed to the beforeRun and afterRun hooks for the full suite. */
export interface RunContext {
  /** Unique identifier for this profiling run. */
  readonly runId: string
  /** Ordered list of execution modes being profiled. */
  readonly modes: readonly string[]
  /** Scenarios included in the suite. */
  readonly scenarios: readonly BaseScenario[]
  /** Number of repetitions configured for each scenario. */
  readonly repetitions: number
}

/** Lifecycle hooks invoked at key points during a profile suite run. */
export type RunHooks = {
  /** Called before each scenario iteration starts. */
  readonly beforeScenario?: (ctx: BeforeScenarioContext) => Promise<void>
  /** Called after each scenario iteration completes (success or failure). */
  readonly afterScenario?: (ctx: AfterScenarioContext) => Promise<void>
  /** Called before the first scenario iteration for a given mode. */
  readonly beforeMode?: (mode: string) => Promise<void>
  /** Called after all scenario iterations for a given mode complete. */
  readonly afterMode?: (mode: string) => Promise<void>
  /** Called once before the entire profiling suite begins. */
  readonly beforeRun?: (ctx: RunContext) => Promise<void>
  /** Called once after the entire profiling suite completes. */
  readonly afterRun?: (ctx: RunContext) => Promise<void>
}
