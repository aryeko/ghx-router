import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"

/** Result of a single checkpoint evaluated by a scorer. */
export interface ScorerCheckResult {
  /** Unique identifier for this checkpoint. */
  readonly id: string
  /** Human-readable description of what the checkpoint verifies. */
  readonly description: string
  /** Whether this checkpoint passed. */
  readonly passed: boolean
  /** The actual value observed during evaluation, if applicable. */
  readonly actual?: unknown
  /** The expected value defined by the scenario, if applicable. */
  readonly expected?: unknown
  /** Error message if the checkpoint threw during evaluation. */
  readonly error?: string
}

/** Aggregated outcome returned by a scorer after evaluating all checkpoints. */
export interface ScorerResult {
  /** True when all required checkpoints passed. */
  readonly success: boolean
  /** Number of checkpoints that passed. */
  readonly passed: number
  /** Total number of checkpoints evaluated. */
  readonly total: number
  /** Per-checkpoint evaluation details. */
  readonly details: readonly ScorerCheckResult[]
  /** True when the agent output conforms to the expected schema or format. */
  readonly outputValid: boolean
  /** Top-level error message if the scorer itself encountered a failure. */
  readonly error?: string
}

/** Contextual data made available to a scorer during evaluation. */
export interface ScorerContext {
  /** Raw text output produced by the agent. */
  readonly agentOutput: string
  /** Full session trace, or null if session export was disabled. */
  readonly trace: SessionTrace | null
  /** Execution mode name for this iteration. */
  readonly mode: string
  /** Model identifier used during this iteration. */
  readonly model: string
  /** Zero-based repetition index for this scenario run. */
  readonly iteration: number
  /** Arbitrary metadata attached by the caller. */
  readonly metadata: Readonly<Record<string, unknown>>
}

/** Evaluate agent output against scenario success criteria. */
export interface Scorer {
  /** Unique identifier for this scorer implementation. */
  readonly id: string
  /**
   * Evaluate a completed scenario run against defined checkpoints.
   * @param scenario - The scenario that was executed.
   * @param context - Contextual data including agent output and trace.
   * @returns The aggregated scoring result with per-checkpoint details.
   */
  evaluate(scenario: BaseScenario, context: ScorerContext): Promise<ScorerResult>
}
