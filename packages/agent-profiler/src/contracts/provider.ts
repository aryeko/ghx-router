import type {
  CostBreakdown,
  TimingBreakdown,
  TokenBreakdown,
  ToolCallRecord,
} from "../types/metrics.js"
import type { SessionTrace } from "../types/trace.js"

/** Controls which tools the agent is permitted to invoke automatically. */
export interface PermissionConfig {
  /** When true, all tool invocations are approved without user confirmation. */
  readonly autoApprove: boolean
  /** List of tool names that are permitted for use during a session. */
  readonly allowedTools: readonly string[]
}

/** Configuration passed to a provider when initializing a profiling run. */
export interface ProviderConfig {
  /** Port number the provider server listens on (0 for any available port). */
  readonly port: number
  /** Model identifier to use for agent sessions. */
  readonly model: string
  /** Execution mode name (e.g., "ghx", "agent_direct"). */
  readonly mode: string
  /** Permission settings controlling tool approval behavior. */
  readonly permissions: PermissionConfig
  /** Environment variables to inject into the agent process. */
  readonly environment: Readonly<Record<string, string>>
  /** Working directory for the agent session. */
  readonly workdir: string
}

/** Parameters required to create a new agent session. */
export interface CreateSessionParams {
  /** System-level instructions to seed the agent context. */
  readonly systemInstructions: string
  /** Identifier of the scenario being executed. */
  readonly scenarioId: string
  /** Zero-based repetition index for this scenario run. */
  readonly iteration: number
}

/** Opaque handle returned after successfully creating an agent session. */
export interface SessionHandle {
  /** Provider-assigned unique identifier for this session. */
  readonly sessionId: string
  /** Identifier of the provider that owns this session. */
  readonly provider: string
  /** ISO 8601 timestamp recording when the session was created. */
  readonly createdAt: string
}

/** Result returned after sending a prompt to an agent session. */
export interface PromptResult {
  /** Final text output produced by the agent. */
  readonly text: string
  /** Raw metrics collected during the prompt execution. */
  readonly metrics: {
    /** Token usage breakdown for the prompt. */
    readonly tokens: TokenBreakdown
    /** Wall-clock and segment timing data. */
    readonly timing: TimingBreakdown
    /** Ordered list of tool calls made during the prompt. */
    readonly toolCalls: readonly ToolCallRecord[]
    /** Cost breakdown for the prompt in USD. */
    readonly cost: CostBreakdown
  }
  /** Reason the agent stopped producing output. */
  readonly completionReason: "stop" | "timeout" | "error" | "tool_limit"
}

/** Drive agent sessions for a specific provider platform. */
export interface SessionProvider {
  /** Unique identifier for this provider. */
  readonly id: string
  /**
   * Initialize the provider with the given configuration before creating sessions.
   * @param config - Provider configuration including port, model, and permissions.
   */
  init(config: ProviderConfig): Promise<void>
  /**
   * Create a new isolated agent session.
   * @param params - Parameters describing the session context.
   * @returns A handle identifying the newly created session.
   */
  createSession(params: CreateSessionParams): Promise<SessionHandle>
  /**
   * Send a prompt to an existing session and wait for the agent response.
   * @param handle - The session to prompt.
   * @param text - The prompt text to send.
   * @param timeoutMs - Maximum milliseconds to wait before aborting.
   * @returns The agent response along with collected metrics.
   */
  prompt(handle: SessionHandle, text: string, timeoutMs?: number): Promise<PromptResult>
  /**
   * Export the full event trace for a completed session.
   * @param handle - The session to export.
   * @returns A structured trace of all events that occurred.
   */
  exportSession(handle: SessionHandle): Promise<SessionTrace>
  /**
   * Tear down and clean up a session, releasing any held resources.
   * @param handle - The session to destroy.
   */
  destroySession(handle: SessionHandle): Promise<void>
  /** Shut down the provider and release all resources. */
  shutdown(): Promise<void>
}
