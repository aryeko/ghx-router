import { OpencodeSessionProvider } from "@bench/provider/opencode/provider.js"
import type { SessionHandle } from "@bench/provider/types.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  withIsolatedBenchmarkClientMock: vi.fn(),
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
  withIsolatedBenchmarkClient: mocks.withIsolatedBenchmarkClientMock,
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

describe("OpencodeSessionProvider - createSession", () => {
  let provider: OpencodeSessionProvider

  const mockClient = {
    session: {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(),
      abort: vi.fn(),
    },
  }

  beforeEach(() => {
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
  })

  it("calls withIsolatedBenchmarkClient with correct parameters", async () => {
    mocks.withIsolatedBenchmarkClientMock.mockImplementation(
      async (mode: string, pid: string, mid: string, run: (ctx: unknown) => unknown) => {
        return run({ client: mockClient, systemInstruction: "test instruction" })
      },
    )
    mockClient.session.create.mockResolvedValue({ data: { id: "session-1" } })

    await provider.createSession({
      systemInstructions: ["instruction1"],
      mode: "agent_direct",
    })

    expect(mocks.withIsolatedBenchmarkClientMock).toHaveBeenCalledWith(
      "agent_direct",
      "openai",
      "gpt-4",
      expect.any(Function),
    )
  })

  it("creates a session via the session API", async () => {
    mocks.withIsolatedBenchmarkClientMock.mockImplementation(
      async (mode: string, pid: string, mid: string, run: (ctx: unknown) => unknown) => {
        return run({ client: mockClient, systemInstruction: "test instruction" })
      },
    )
    mockClient.session.create.mockResolvedValue({ data: { id: "session-1" } })

    await provider.createSession({
      systemInstructions: ["instruction1"],
      mode: "ghx",
    })

    expect(mockClient.session.create).toHaveBeenCalledWith({
      url: "/session",
    })
  })

  it("returns a session handle with the session id", async () => {
    mocks.withIsolatedBenchmarkClientMock.mockImplementation(
      async (mode: string, pid: string, mid: string, run: (ctx: unknown) => unknown) => {
        return run({ client: mockClient, systemInstruction: "test instruction" })
      },
    )
    mockClient.session.create.mockResolvedValue({ data: { id: "session-xyz" } })

    const handle = await provider.createSession({
      systemInstructions: ["instruction1"],
      mode: "agent_direct",
    })

    expect(handle.sessionId).toBe("session-xyz")
  })

  it("throws if benchmarkClient is null after withIsolatedBenchmarkClient", async () => {
    mocks.withIsolatedBenchmarkClientMock.mockImplementation(
      async (mode: string, pid: string, mid: string, run: (ctx: unknown) => unknown) => run(null),
    )

    await expect(
      provider.createSession({
        systemInstructions: ["instruction1"],
        mode: "agent_direct",
      }),
    ).rejects.toThrow("Failed to initialize benchmark client")
  })

  it("applies withTimeout to session.create call", async () => {
    mocks.withIsolatedBenchmarkClientMock.mockImplementation(
      async (mode: string, pid: string, mid: string, run: (ctx: unknown) => unknown) => {
        return run({ client: mockClient, systemInstruction: "test instruction" })
      },
    )
    mockClient.session.create.mockResolvedValue({ data: { id: "session-1" } })

    await provider.createSession({
      systemInstructions: ["instruction1"],
      mode: "agent_direct",
    })

    expect(mocks.withTimeoutMock).toHaveBeenCalled()
    expect(mocks.withTimeoutMock.mock.calls[0]?.[1]).toBe(30000)
    expect(mocks.withTimeoutMock.mock.calls[0]?.[2]).toBe("session.create")
  })
})

describe("OpencodeSessionProvider - cleanup", () => {
  let provider: OpencodeSessionProvider

  const mockClient = {
    session: {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(),
      abort: vi.fn(),
    },
  }

  let sessionHandle: SessionHandle

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
    mocks.withIsolatedBenchmarkClientMock.mockImplementation(
      async (mode: string, pid: string, mid: string, run: (ctx: unknown) => unknown) => {
        return run({ client: mockClient, systemInstruction: "test instruction" })
      },
    )
    mockClient.session.create.mockResolvedValue({ data: { id: "session-1" } })

    sessionHandle = await provider.createSession({
      systemInstructions: ["instruction1"],
      mode: "agent_direct",
    })
  })

  it("sets benchmarkClient to null", async () => {
    await provider.cleanup()

    await expect(provider.prompt(sessionHandle, "test prompt")).rejects.toThrow(
      "No session initialized",
    )
  })

  it("prevents subsequent prompts", async () => {
    await provider.cleanup()

    const newProvider = new OpencodeSessionProvider({
      type: "opencode",
      providerId: "openai",
      modelId: "gpt-4",
    })

    await expect(newProvider.prompt(sessionHandle, "test prompt")).rejects.toThrow(
      "No session initialized",
    )
  })
})
