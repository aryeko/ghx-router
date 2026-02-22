import type {
  BenchmarkMode,
  BenchmarkTimingBreakdown,
  SessionMessagePart,
} from "@bench/domain/types.js"

export type SessionConfig = {
  systemInstructions: string[]
  mode: BenchmarkMode
}

export type SessionHandle = {
  sessionId: string
}

export type TokenBreakdown = {
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  total: number
}

export type PromptResult = {
  tokens: TokenBreakdown
  toolCalls: number
  cost: number
  latencyMs: number
  sdkLatencyMs: number | null
  timingBreakdown: BenchmarkTimingBreakdown | null
  model: { providerId: string; modelId: string }
  outputValid: boolean
  parts: SessionMessagePart[]
}

export interface SessionProvider {
  createSession(config: SessionConfig): Promise<SessionHandle>
  prompt(handle: SessionHandle, text: string): Promise<PromptResult>
  cleanup(): Promise<void>
}
