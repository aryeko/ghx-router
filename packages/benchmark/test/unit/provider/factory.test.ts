import { createSessionProvider } from "@bench/provider/factory.js"
import { describe, expect, it, vi } from "vitest"

const OpencodeSessionProviderMock = vi.hoisted(() => vi.fn())
vi.mock("@bench/provider/opencode/provider.js", () => ({
  OpencodeSessionProvider: OpencodeSessionProviderMock,
}))

describe("createSessionProvider", () => {
  it("creates an OpencodeSessionProvider for opencode type", async () => {
    const mockInstance = { foo: "bar" }
    OpencodeSessionProviderMock.mockReturnValue(mockInstance)

    const provider = await createSessionProvider({
      type: "opencode",
      providerId: "openai",
      modelId: "gpt-4",
    })

    expect(OpencodeSessionProviderMock).toHaveBeenCalledWith({
      type: "opencode",
      providerId: "openai",
      modelId: "gpt-4",
    })
    expect(provider).toBe(mockInstance)
  })

  it("passes the correct config to OpencodeSessionProvider", async () => {
    OpencodeSessionProviderMock.mockReturnValue({})

    await createSessionProvider({
      type: "opencode",
      providerId: "anthropic",
      modelId: "claude-3",
    })

    expect(OpencodeSessionProviderMock).toHaveBeenCalledWith({
      type: "opencode",
      providerId: "anthropic",
      modelId: "claude-3",
    })
  })

  it("config does not include mode", async () => {
    OpencodeSessionProviderMock.mockReturnValue({})

    await createSessionProvider({
      type: "opencode",
      providerId: "openai",
      modelId: "gpt-3.5",
    })

    const callArgs = OpencodeSessionProviderMock.mock.calls[0]?.[0]
    expect(callArgs).not.toHaveProperty("mode")
    expect(callArgs).toHaveProperty("type")
    expect(callArgs).toHaveProperty("providerId")
    expect(callArgs).toHaveProperty("modelId")
  })
})
