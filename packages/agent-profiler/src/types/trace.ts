import type { TokenBreakdown } from "./metrics.js"

/**
 * A single observable event captured during an agent session.
 * Discriminated by the `type` field.
 */
export type TraceEvent =
  | {
      /** Extended reasoning step produced by the model. */
      readonly type: "reasoning"
      /** Full text content of the reasoning block. */
      readonly content: string
      /** Duration of the reasoning step in milliseconds. */
      readonly durationMs: number
      /** Number of tokens consumed by this reasoning block. */
      readonly tokenCount: number
    }
  | {
      /** A tool invocation made by the agent. */
      readonly type: "tool_call"
      /** Name of the tool that was called. */
      readonly name: string
      /** Input arguments passed to the tool. */
      readonly input: unknown
      /** Output returned by the tool. */
      readonly output: unknown
      /** Duration of the tool call in milliseconds. */
      readonly durationMs: number
      /** Whether the tool call completed without error. */
      readonly success: boolean
      /** Error message if the tool call failed. */
      readonly error?: string
    }
  | {
      /** Text output produced by the model in its response. */
      readonly type: "text_output"
      /** Text content of the output block. */
      readonly content: string
      /** Number of tokens in this output block. */
      readonly tokenCount: number
    }
  | {
      /** Marker event delineating the boundary between agent turns. */
      readonly type: "turn_boundary"
      /** One-based turn number this boundary concludes. */
      readonly turnNumber: number
      /** ISO 8601 timestamp for this boundary event. */
      readonly timestamp: string
    }
  | {
      /** An error that occurred during session execution. */
      readonly type: "error"
      /** Error message describing what went wrong. */
      readonly message: string
      /** True when the agent attempted to recover from this error. */
      readonly recoverable: boolean
    }

/** A single agent conversation turn comprising one or more trace events. */
export interface Turn {
  /** One-based turn number within the session. */
  readonly number: number
  /** Ordered list of events that occurred during this turn. */
  readonly events: readonly TraceEvent[]
  /** ISO 8601 timestamp when this turn began. */
  readonly startTimestamp: string
  /** ISO 8601 timestamp when this turn ended. */
  readonly endTimestamp: string
  /** Duration of this turn in milliseconds. */
  readonly durationMs: number
}

/** Complete event trace for an agent session, including per-turn structure and aggregate summaries. */
export interface SessionTrace {
  /** Provider-assigned session identifier. */
  readonly sessionId: string
  /** Flat ordered list of all events across all turns. */
  readonly events: readonly TraceEvent[]
  /** Events grouped by agent turn. */
  readonly turns: readonly Turn[]
  /** Aggregate metrics computed over the full session. */
  readonly summary: {
    /** Total number of agent turns in this session. */
    readonly totalTurns: number
    /** Total number of tool calls made across all turns. */
    readonly totalToolCalls: number
    /** Cumulative token usage across the entire session. */
    readonly totalTokens: TokenBreakdown
    /** Total session duration in milliseconds. */
    readonly totalDuration: number
  }
}

/** Structured output produced by a single analyzer for a session trace. */
export interface AnalysisResult {
  /** Name of the analyzer that produced these findings. */
  readonly analyzer: string
  /** Named findings keyed by finding identifier. */
  readonly findings: Readonly<Record<string, AnalysisFinding>>
  /** Human-readable summary of the most significant findings. */
  readonly summary: string
}

/**
 * A single named finding from an analysis result.
 * Discriminated by the `type` field to support different value shapes.
 */
export type AnalysisFinding =
  | { readonly type: "number"; readonly value: number; readonly unit: string }
  | { readonly type: "string"; readonly value: string }
  | { readonly type: "list"; readonly values: readonly string[] }
  | {
      readonly type: "table"
      readonly headers: readonly string[]
      readonly rows: readonly (readonly string[])[]
    }
  | { readonly type: "ratio"; readonly value: number; readonly label: string }

/** Groups all analysis results for a single session across multiple analyzers. */
export interface SessionAnalysisBundle {
  /** Provider-assigned session identifier. */
  readonly sessionId: string
  /** Identifier of the scenario that was executed. */
  readonly scenarioId: string
  /** Execution mode name for this session. */
  readonly mode: string
  /** Model identifier used during this session. */
  readonly model: string
  /** Analysis results keyed by analyzer name. */
  readonly results: Readonly<Record<string, AnalysisResult>>
}
