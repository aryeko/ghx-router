/** Common fields shared by all scenario definitions. */
export interface BaseScenario {
  /** Unique identifier for this scenario (used as a file/key name). */
  readonly id: string
  /** Short human-readable name for display in reports. */
  readonly name: string
  /** Longer description of what the scenario tests. */
  readonly description: string
  /** The prompt text sent to the agent at the start of the session. */
  readonly prompt: string
  /** Maximum time in milliseconds the agent may run before being timed out. */
  readonly timeoutMs: number
  /** Number of additional attempts permitted if the iteration fails. */
  readonly allowedRetries: number
  /** Descriptive tags used for filtering and grouping scenarios. */
  readonly tags: readonly string[]
  /** Arbitrary extension data for scenario-specific configuration. */
  readonly extensions: Readonly<Record<string, unknown>>
}

/** Named sets of scenario IDs, keyed by set name. */
export type ScenarioSets = Readonly<Record<string, readonly string[]>>

/**
 * Function that loads scenario definitions by their IDs.
 * @param ids - The list of scenario identifiers to load.
 * @returns The resolved scenario objects in the same order as the input IDs.
 */
export type ScenarioLoader = (ids: readonly string[]) => Promise<readonly BaseScenario[]>

/** Event emitted during suite execution to report iteration-level progress. */
export interface ProgressEvent {
  /** The lifecycle phase this event describes. */
  readonly type: "scenario_start" | "scenario_end" | "iteration_start" | "iteration_end"
  /** Identifier of the scenario this event relates to. */
  readonly scenarioId: string
  /** Execution mode active when this event was emitted. */
  readonly mode: string
  /** Zero-based repetition index for this event. */
  readonly iteration: number
  /** ISO 8601 timestamp when this event was emitted. */
  readonly timestamp: string
}
