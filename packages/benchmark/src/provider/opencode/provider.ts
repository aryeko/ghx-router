import type { PromptResult, SessionConfig, SessionHandle, SessionProvider } from "../types.js"
import { type BenchmarkClient, withIsolatedBenchmarkClient } from "./client-setup.js"
import {
  aggregateToolCounts,
  coercePromptResponse,
  extractPromptResponseFromPromptResult,
  extractTimingBreakdown,
} from "./extraction.js"
import {
  fetchSessionMessages,
  getSessionApi,
  waitForAssistantFromMessages,
  withTimeout,
} from "./polling.js"

export type OpencodeProviderConfig = {
  type: "opencode"
  providerId: string
  modelId: string
}

export class OpencodeSessionProvider implements SessionProvider {
  private config: OpencodeProviderConfig
  private benchmarkClient: BenchmarkClient | null = null

  constructor(config: OpencodeProviderConfig) {
    this.config = config
  }

  async createSession(config: SessionConfig): Promise<SessionHandle> {
    this.benchmarkClient = await new Promise((resolve, reject) => {
      withIsolatedBenchmarkClient(
        config.mode,
        this.config.providerId,
        this.config.modelId,
        async (ctx) => {
          resolve(ctx)
          return null
        },
      ).catch(reject)
    })

    if (!this.benchmarkClient) {
      throw new Error("Failed to initialize benchmark client")
    }

    const sessionApi = getSessionApi(this.benchmarkClient.client)
    const sessionResult = await withTimeout(
      sessionApi.create({ url: "/session" }),
      30000,
      "session.create",
    )

    const sessionData = this.unwrapData<{ id: string }>(sessionResult, "session.create")
    return { sessionId: sessionData.id }
  }

  async prompt(handle: SessionHandle, text: string): Promise<PromptResult> {
    if (!this.benchmarkClient) {
      throw new Error("No session initialized")
    }

    const sessionApi = getSessionApi(this.benchmarkClient.client)
    const wallClockStart = Date.now()

    const promptResult = await withTimeout(
      sessionApi.promptAsync({
        url: "/session/{id}/prompt_async",
        path: { id: handle.sessionId },
        body: {
          model: {
            providerID: this.config.providerId,
            modelID: this.config.modelId,
          },
          system: this.benchmarkClient.systemInstruction,
          parts: [{ type: "text", text }],
        },
      }),
      60000,
      "session.promptAsync",
    )

    const remainingTimeoutMs = Math.max(1000, 180000 - (Date.now() - wallClockStart))
    const immediatePrompt = extractPromptResponseFromPromptResult(promptResult)
    const hydrated =
      immediatePrompt ||
      (await waitForAssistantFromMessages(
        sessionApi,
        handle.sessionId,
        remainingTimeoutMs,
        "provider-session",
        undefined,
      ))
    const assistantAndParts = coercePromptResponse(hydrated)
    const assistant = assistantAndParts.assistant
    const parts = assistantAndParts.parts

    const allMessages = await fetchSessionMessages(sessionApi, handle.sessionId)
    const toolCounts = aggregateToolCounts(allMessages)
    const timingBreakdown = extractTimingBreakdown(allMessages)

    const latencyWall = Date.now() - wallClockStart
    const sdkLatency =
      typeof assistant.time.completed === "number"
        ? Math.max(0, assistant.time.completed - assistant.time.created)
        : null

    const tokenTotal =
      assistant.tokens.input +
      assistant.tokens.output +
      assistant.tokens.reasoning +
      assistant.tokens.cache.read +
      assistant.tokens.cache.write

    return {
      tokens: {
        input: assistant.tokens.input,
        output: assistant.tokens.output,
        reasoning: assistant.tokens.reasoning,
        cacheRead: assistant.tokens.cache.read,
        cacheWrite: assistant.tokens.cache.write,
        total: tokenTotal,
      },
      toolCalls: toolCounts.toolCalls,
      cost: assistant.cost,
      latencyMs: latencyWall,
      sdkLatencyMs: sdkLatency,
      timingBreakdown,
      model: {
        providerId: this.config.providerId,
        modelId: this.config.modelId,
      },
      outputValid: true,
      parts,
    }
  }

  async cleanup(): Promise<void> {
    this.benchmarkClient = null
  }

  private unwrapData<T>(value: unknown, label: string): T {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>
      if ("data" in obj) {
        if (obj.error) {
          throw new Error(`${label} returned error payload`)
        }
        return obj.data as T
      }
    }

    return value as T
  }
}
