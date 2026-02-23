import { OpencodeSessionProvider } from "@bench/provider/opencode/provider.js"
import type { SessionHandle } from "@bench/provider/types.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  openBenchmarkClientMock: vi.fn(),
  getSessionApiMock: vi.fn(),
  withTimeoutMock: vi.fn(),
  waitForAssistantFromMessagesMock: vi.fn(),
  fetchSessionMessagesMock: vi.fn(),
  aggregateToolCountsMock: vi.fn(),
  coercePromptResponseMock: vi.fn(),
  extractPromptResponseFromPromptResultMock: vi.fn(),
  extractTimingBreakdownMock: vi.fn(),
}))

vi.mock("@bench/provider/opencode/client-setup.js", () => ({
  openBenchmarkClient: mocks.openBenchmarkClientMock,
}))

vi.mock("@bench/provider/opencode/polling.js", () => ({
  getSessionApi: mocks.getSessionApiMock,
  withTimeout: mocks.withTimeoutMock,
  fetchSessionMessages: mocks.fetchSessionMessagesMock,
}))

vi.mock("@bench/provider/opencode/wait-for-assistant.js", () => ({
  waitForAssistantFromMessages: mocks.waitForAssistantFromMessagesMock,
}))

vi.mock("@bench/provider/opencode/extraction.js", () => ({
  aggregateToolCounts: mocks.aggregateToolCountsMock,
  coercePromptResponse: mocks.coercePromptResponseMock,
  extractPromptResponseFromPromptResult: mocks.extractPromptResponseFromPromptResultMock,
  extractTimingBreakdown: mocks.extractTimingBreakdownMock,
}))

describe("OpencodeSessionProvider - prompt execution", () => {
  let provider: OpencodeSessionProvider
  let sessionHandle: SessionHandle

  const mockAssistant = {
    time: { created: 1000, completed: 1500 },
    tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 5, write: 2 } },
    cost: 0.01,
  }

  const mockClient = {
    session: {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(),
      abort: vi.fn(),
    },
  }

  const mockClose = vi.fn().mockResolvedValue(undefined)

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"))

    provider = new OpencodeSessionProvider({
      type: "opencode",
      providerId: "openai",
      modelId: "gpt-4",
    })

    mocks.withTimeoutMock.mockImplementation((promise: Promise<unknown>) => promise)
    mocks.getSessionApiMock.mockReturnValue(mockClient.session)
    mocks.waitForAssistantFromMessagesMock.mockResolvedValue({
      info: mockAssistant,
      parts: [{ type: "text", text: "response" }],
    })
    mocks.fetchSessionMessagesMock.mockResolvedValue([])
    mocks.aggregateToolCountsMock.mockReturnValue({ toolCalls: 2, apiCalls: 0 })
    mocks.coercePromptResponseMock.mockReturnValue({
      assistant: mockAssistant,
      parts: [{ type: "text", text: "response" }],
    })
    mocks.extractPromptResponseFromPromptResultMock.mockReturnValue(null)
    mocks.extractTimingBreakdownMock.mockReturnValue(null)

    mocks.openBenchmarkClientMock.mockResolvedValue({
      client: mockClient,
      systemInstruction: "test instruction",
      close: mockClose,
    })
    mockClient.session.create.mockResolvedValue({ data: { id: "session-1" } })

    sessionHandle = await provider.createSession({
      systemInstructions: ["instruction1"],
      mode: "agent_direct",
    })
  })

  it("throws if no session initialized", async () => {
    const newProvider = new OpencodeSessionProvider({
      type: "opencode",
      providerId: "openai",
      modelId: "gpt-4",
    })

    await expect(newProvider.prompt(sessionHandle, "test prompt")).rejects.toThrow(
      "No session initialized",
    )
  })

  it("sends prompt with correct parameters", async () => {
    mockClient.session.promptAsync.mockResolvedValue({
      info: mockAssistant,
      parts: [{ type: "text", text: "response" }],
    })

    await provider.prompt(sessionHandle, "test prompt")

    expect(mockClient.session.promptAsync).toHaveBeenCalledWith({
      url: "/session/{id}/prompt_async",
      path: { id: "session-1" },
      body: {
        model: {
          providerID: "openai",
          modelID: "gpt-4",
        },
        system: "test instruction",
        parts: [{ type: "text", text: "test prompt" }],
      },
    })
  })

  it("applies 60000ms timeout to promptAsync", async () => {
    await provider.prompt(sessionHandle, "test prompt")

    const timeoutCalls = mocks.withTimeoutMock.mock.calls.filter(
      (call: unknown[]) => call[2] === "session.promptAsync",
    )
    expect(timeoutCalls.length).toBeGreaterThan(0)
    expect(timeoutCalls[0]?.[1]).toBe(60000)
  })

  it("returns PromptResult with correct token breakdown", async () => {
    mockClient.session.promptAsync.mockResolvedValue({})

    const result = await provider.prompt(sessionHandle, "test prompt")

    expect(result.tokens.input).toBe(100)
    expect(result.tokens.output).toBe(50)
    expect(result.tokens.reasoning).toBe(10)
    expect(result.tokens.cacheRead).toBe(5)
    expect(result.tokens.cacheWrite).toBe(2)
    expect(result.tokens.total).toBe(167)
  })

  it("calculates total tokens correctly", async () => {
    const customAssistant = {
      time: { created: 1000, completed: 1500 },
      tokens: { input: 100, output: 200, reasoning: 50, cache: { read: 10, write: 20 } },
      cost: 0.05,
    }
    mocks.coercePromptResponseMock.mockReturnValue({
      assistant: customAssistant,
      parts: [{ type: "text", text: "response" }],
    })

    const result = await provider.prompt(sessionHandle, "test prompt")

    expect(result.tokens.total).toBe(380)
  })

  it("returns cost from assistant response", async () => {
    const customAssistant = {
      ...mockAssistant,
      cost: 0.25,
    }
    mocks.coercePromptResponseMock.mockReturnValue({
      assistant: customAssistant,
      parts: [{ type: "text", text: "response" }],
    })

    const result = await provider.prompt(sessionHandle, "test prompt")

    expect(result.cost).toBe(0.25)
  })

  it("calculates SDK latency from time.completed and time.created", async () => {
    const customAssistant = {
      time: { created: 1000, completed: 3500 },
      tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 5, write: 2 } },
      cost: 0.01,
    }
    mocks.coercePromptResponseMock.mockReturnValue({
      assistant: customAssistant,
      parts: [{ type: "text", text: "response" }],
    })

    const result = await provider.prompt(sessionHandle, "test prompt")

    expect(result.sdkLatencyMs).toBe(2500)
  })

  it("returns null sdkLatencyMs when time.completed is missing", async () => {
    const customAssistant = {
      time: { created: 1000 },
      tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 5, write: 2 } },
      cost: 0.01,
    } as unknown
    mocks.coercePromptResponseMock.mockReturnValue({
      assistant: customAssistant,
      parts: [{ type: "text", text: "response" }],
    })

    const result = await provider.prompt(sessionHandle, "test prompt")

    expect(result.sdkLatencyMs).toBeNull()
  })

  it("returns toolCalls from aggregateToolCounts", async () => {
    mocks.aggregateToolCountsMock.mockReturnValue({ toolCalls: 5, apiCalls: 1 })

    const result = await provider.prompt(sessionHandle, "test prompt")

    expect(result.toolCalls).toBe(5)
  })

  it("returns apiCalls from aggregateToolCounts", async () => {
    mocks.aggregateToolCountsMock.mockReturnValue({ toolCalls: 5, apiCalls: 3 })

    const result = await provider.prompt(sessionHandle, "test prompt")

    expect(result.apiCalls).toBe(3)
  })

  it("returns outputValid as true", async () => {
    const result = await provider.prompt(sessionHandle, "test prompt")

    expect(result.outputValid).toBe(true)
  })

  it("includes model information in result", async () => {
    const result = await provider.prompt(sessionHandle, "test prompt")

    expect(result.model.providerId).toBe("openai")
    expect(result.model.modelId).toBe("gpt-4")
  })

  it("includes parts from response", async () => {
    const parts = [
      { type: "text", text: "hello" },
      { type: "tool", tool: "bash" },
    ]
    mocks.coercePromptResponseMock.mockReturnValue({
      assistant: mockAssistant,
      parts,
    })

    const result = await provider.prompt(sessionHandle, "test prompt")

    expect(result.parts).toEqual(parts)
  })

  it("includes timingBreakdown from extraction", async () => {
    const timing = {
      assistant_total_ms: 100,
      assistant_pre_reasoning_ms: 10,
      assistant_reasoning_ms: 50,
      assistant_between_reasoning_and_tool_ms: 20,
      assistant_post_tool_ms: 20,
      tool_total_ms: 200,
      tool_bash_ms: 150,
      tool_structured_output_ms: 50,
      observed_assistant_turns: 1,
    }
    mocks.extractTimingBreakdownMock.mockReturnValue(timing)

    const result = await provider.prompt(sessionHandle, "test prompt")

    expect(result.timingBreakdown).toEqual(timing)
  })
})

describe("OpencodeSessionProvider - data unwrapping", () => {
  let provider: OpencodeSessionProvider

  const mockClient = {
    session: {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(),
      abort: vi.fn(),
    },
  }

  const mockClose = vi.fn().mockResolvedValue(undefined)

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"))

    provider = new OpencodeSessionProvider({
      type: "opencode",
      providerId: "openai",
      modelId: "gpt-4",
    })

    mocks.withTimeoutMock.mockImplementation((promise: Promise<unknown>) => promise)
    mocks.getSessionApiMock.mockReturnValue(mockClient.session)
    mocks.openBenchmarkClientMock.mockResolvedValue({
      client: mockClient,
      systemInstruction: "test instruction",
      close: mockClose,
    })
    mockClient.session.create.mockResolvedValue({ data: { id: "session-1" } })

    await provider.createSession({
      systemInstructions: ["instruction1"],
      mode: "agent_direct",
    })
  })

  it("throws when response has error payload", async () => {
    mockClient.session.create.mockResolvedValue({ data: null, error: "API error" })

    await expect(
      provider.createSession({
        systemInstructions: ["instruction1"],
        mode: "agent_direct",
      }),
    ).rejects.toThrow("returned error payload")
  })

  it("unwraps data from { data } wrapper", async () => {
    mockClient.session.create.mockResolvedValue({ data: { id: "session-xyz" } })

    const handle = await provider.createSession({
      systemInstructions: ["instruction1"],
      mode: "agent_direct",
    })

    expect(handle.sessionId).toBe("session-xyz")
  })

  it("passes through raw value when not wrapped", async () => {
    mockClient.session.create.mockResolvedValue({ id: "session-raw" })

    const handle = await provider.createSession({
      systemInstructions: ["instruction1"],
      mode: "agent_direct",
    })

    expect(handle.sessionId).toBe("session-raw")
  })
})
