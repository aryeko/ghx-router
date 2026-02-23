import type {
  PromptResult,
  SessionConfig,
  SessionHandle,
  SessionProvider,
} from "@bench/provider/types.js"

export function createMockSessionProvider(overrides?: {
  promptResult?: Partial<PromptResult>
}): SessionProvider {
  let sessionCount = 0
  const defaultResult: PromptResult = {
    tokens: {
      input: 100,
      output: 50,
      reasoning: 10,
      cacheRead: 0,
      cacheWrite: 0,
      total: 160,
    },
    toolCalls: 2,
    apiCalls: 0,
    cost: 0.01,
    latencyMs: 1000,
    sdkLatencyMs: 950,
    timingBreakdown: null,
    model: { providerId: "test-provider", modelId: "test-model" },
    outputValid: true,
    parts: [{ type: "text", text: "Mock response" }],
  }

  return {
    async createSession(_config: SessionConfig): Promise<SessionHandle> {
      sessionCount++
      return { sessionId: `mock-session-${sessionCount}` }
    },
    async prompt(_handle: SessionHandle, _text: string): Promise<PromptResult> {
      return { ...defaultResult, ...overrides?.promptResult }
    },
    async cleanup(): Promise<void> {},
  }
}
