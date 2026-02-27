import type { CostBreakdown, TimingBreakdown, TokenBreakdown, ToolCallRecord } from "./metrics.js"

/** Result of a single checkpoint evaluation stored on a ProfileRow. */
export interface CheckpointResult {
  /** Unique identifier for this checkpoint. */
  readonly id: string
  /** Human-readable description of what the checkpoint verifies. */
  readonly description: string
  /** Whether the checkpoint passed. */
  readonly passed: boolean
  /** Actual value observed during evaluation, if applicable. */
  readonly actual?: unknown
  /** Expected value defined by the scenario, if applicable. */
  readonly expected?: unknown
}

/** Full data record for a single scenario iteration written to JSONL output. */
export interface ProfileRow {
  /** Identifier of the profiling run this row belongs to. */
  readonly runId: string
  /** Identifier of the scenario that was executed. */
  readonly scenarioId: string
  /** Execution mode name for this iteration. */
  readonly mode: string
  /** Model identifier used during this iteration. */
  readonly model: string
  /** Zero-based repetition index. */
  readonly iteration: number

  /** ISO 8601 timestamp when the iteration started. */
  readonly startedAt: string
  /** ISO 8601 timestamp when the iteration completed. */
  readonly completedAt: string

  /** Token usage breakdown for this iteration. */
  readonly tokens: TokenBreakdown
  /** Wall-clock and segment timing data for this iteration. */
  readonly timing: TimingBreakdown
  /** Aggregated tool call statistics for this iteration. */
  readonly toolCalls: {
    /** Total number of tool calls made. */
    readonly total: number
    /** Tool call counts grouped by category. */
    readonly byCategory: Readonly<Record<string, number>>
    /** Number of tool calls that failed. */
    readonly failed: number
    /** Number of tool calls that were retried. */
    readonly retried: number
    /** Fraction of tool calls that resulted in an error (failed / total). */
    readonly errorRate: number
    /** Ordered list of individual tool call records. */
    readonly records: readonly ToolCallRecord[]
  }
  /** Cost breakdown for this iteration in USD. */
  readonly cost: CostBreakdown

  /** True when all required checkpoints passed. */
  readonly success: boolean
  /** Number of checkpoints that passed. */
  readonly checkpointsPassed: number
  /** Total number of checkpoints evaluated. */
  readonly checkpointsTotal: number
  /** Per-checkpoint evaluation results. */
  readonly checkpointDetails: readonly CheckpointResult[]
  /** True when the agent output conformed to the expected format. */
  readonly outputValid: boolean

  /** Identifier of the provider that ran this session. */
  readonly provider: string
  /** Provider-assigned session identifier. */
  readonly sessionId: string
  /** Number of agent conversation turns completed. */
  readonly agentTurns: number
  /** Reason the agent stopped producing output. */
  readonly completionReason: "stop" | "timeout" | "error" | "tool_limit"

  /** Arbitrary key-value extensions populated by collectors. */
  readonly extensions: Readonly<Record<string, unknown>>

  /** Human-readable error message if the iteration failed. */
  readonly error?: string
  /** Machine-readable error code if the iteration failed. */
  readonly errorCode?: string
}
