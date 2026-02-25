import {
  openBenchmarkClient,
  withIsolatedBenchmarkClient,
} from "@bench/provider/opencode/client-setup.js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  return {
    lstatMock: vi.fn(),
    mkdtempMock: vi.fn().mockResolvedValue("/tmp/test-dir"),
    readFileMock: vi.fn().mockResolvedValue("# SKILL.md content"),
    rmMock: vi.fn().mockResolvedValue(undefined),
    spawnSyncMock: vi.fn().mockReturnValue({
      status: 0,
      stdout: "ghtoken\n",
      error: null,
    }),
    createOpencodeMock: vi
      .fn()
      .mockImplementation(
        async (opts: { config: { instructions: string[]; plugin: unknown[] } }) => ({
          server: { close: vi.fn() },
          client: {
            session: {
              create: vi.fn().mockResolvedValue({ data: { id: "session-1" } }),
              promptAsync: vi.fn().mockResolvedValue({}),
              messages: vi.fn().mockResolvedValue({ data: [] }),
              abort: vi.fn().mockResolvedValue({}),
            },
            config: {
              get: vi.fn().mockResolvedValue({
                data: {
                  instructions: opts.config.instructions,
                  plugin: opts.config.plugin ?? [],
                },
              }),
            },
          },
        }),
      ),
    modeInstructionsMock: vi.fn().mockImplementation(async (mode: string, _reader: unknown) => {
      if (mode === "agent_direct") return ["Use GitHub CLI"]
      if (mode === "mcp") return ["Use MCP"]
      return ["mock ghx instruction"]
    }),
  }
})

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return {
    ...actual,
    lstat: mocks.lstatMock,
    mkdtemp: mocks.mkdtempMock,
    readFile: mocks.readFileMock,
    rm: mocks.rmMock,
  }
})

vi.mock("node:child_process", () => ({
  spawnSync: mocks.spawnSyncMock,
}))

vi.mock("@opencode-ai/sdk", () => ({
  createOpencode: mocks.createOpencodeMock,
}))

vi.mock("@bench/runner/mode-instructions.js", () => ({
  modeInstructions: mocks.modeInstructionsMock,
  AGENT_DIRECT_INSTRUCTION: "Use GitHub CLI",
  MCP_INSTRUCTION: "Use MCP",
}))

describe("client-setup", () => {
  let chdirSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    chdirSpy = vi.spyOn(process, "chdir").mockImplementation(() => undefined)
    mocks.mkdtempMock.mockResolvedValue("/tmp/test-dir")
    mocks.readFileMock.mockResolvedValue("# SKILL.md content")
    mocks.rmMock.mockResolvedValue(undefined)
    mocks.spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: "ghtoken\n",
      error: null,
    })
    mocks.modeInstructionsMock.mockImplementation(async (mode: string, _reader: unknown) => {
      if (mode === "agent_direct") return ["Use GitHub CLI"]
      if (mode === "mcp") return ["Use MCP"]
      return ["mock ghx instruction"]
    })

    mocks.createOpencodeMock.mockImplementation(
      async (opts: { config: { instructions: string[]; plugin: unknown[] } }) => ({
        server: { close: vi.fn() },
        client: {
          session: {
            create: vi.fn().mockResolvedValue({ data: { id: "session-1" } }),
            promptAsync: vi.fn().mockResolvedValue({}),
            messages: vi.fn().mockResolvedValue({ data: [] }),
            abort: vi.fn().mockResolvedValue({}),
          },
          config: {
            get: vi.fn().mockResolvedValue({
              data: {
                instructions: opts.config.instructions,
                plugin: opts.config.plugin ?? [],
              },
            }),
          },
        },
      }),
    )
  })

  afterEach(() => {
    chdirSpy.mockRestore()
  })

  describe("withIsolatedBenchmarkClient", () => {
    it("creates temp directory for isolated config", async () => {
      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => ctx)

      expect(mocks.mkdtempMock).toHaveBeenCalled()
      const callArg = mocks.mkdtempMock.mock.calls[0]?.[0]
      expect(callArg).toMatch(/ghx-benchmark-opencode-/)
    })

    it("loads mode instructions", async () => {
      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => ctx)

      expect(mocks.modeInstructionsMock).toHaveBeenCalledWith("agent_direct", expect.any(Function))
    })

    it("calls createOpencode with correct config", async () => {
      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => ctx)

      expect(mocks.createOpencodeMock).toHaveBeenCalled()
      const config = mocks.createOpencodeMock.mock.calls[0]?.[0]
      expect(config.config.model).toBe("openai/gpt-4")
      expect(config.config.instructions).toEqual([])
      expect(config.config.plugin).toEqual([])
    })

    it("passes BenchmarkClient context to run callback", async () => {
      const runCallback = vi.fn().mockResolvedValue("result")

      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", runCallback)

      expect(runCallback).toHaveBeenCalled()
      const ctx = runCallback.mock.calls[0]?.[0]
      expect(ctx).toHaveProperty("client")
      expect(ctx).toHaveProperty("systemInstruction")
      expect(ctx.systemInstruction).toBe("Use GitHub CLI")
    })

    it("calls server.close after run", async () => {
      const closeMock = vi.fn()
      mocks.createOpencodeMock.mockResolvedValue({
        server: { close: closeMock },
        client: {
          session: {
            create: vi.fn().mockResolvedValue({ data: { id: "session-1" } }),
            promptAsync: vi.fn().mockResolvedValue({}),
            messages: vi.fn().mockResolvedValue({ data: [] }),
            abort: vi.fn().mockResolvedValue({}),
          },
          config: {
            get: vi.fn().mockResolvedValue({
              data: { instructions: [], plugin: [] },
            }),
          },
        },
      })

      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => ctx)

      expect(closeMock).toHaveBeenCalled()
    })

    it("cleans up temp directory after run", async () => {
      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => ctx)

      expect(mocks.rmMock).toHaveBeenCalledWith("/tmp/test-dir", {
        recursive: true,
        force: true,
      })
    })

    it("checks ghx alias existence when mode is 'ghx'", async () => {
      mocks.lstatMock.mockResolvedValue({})

      await withIsolatedBenchmarkClient("ghx", "openai", "gpt-4", async (ctx) => ctx)

      expect(mocks.lstatMock).toHaveBeenCalled()
    })

    it("throws preflight error when ghx alias is missing and mode is 'ghx'", async () => {
      mocks.lstatMock.mockRejectedValue(new Error("ENOENT"))

      await expect(
        withIsolatedBenchmarkClient("ghx", "openai", "gpt-4", async (ctx) => ctx),
      ).rejects.toThrow("ghx_preflight_failed")
    })

    it("does not check ghx alias when mode is 'agent_direct'", async () => {
      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => ctx)

      expect(mocks.lstatMock).not.toHaveBeenCalled()
    })

    it("does not check ghx alias when mode is 'mcp'", async () => {
      await withIsolatedBenchmarkClient("mcp", "openai", "gpt-4", async (ctx) => ctx)

      expect(mocks.lstatMock).not.toHaveBeenCalled()
    })

    it("sets XDG_CONFIG_HOME env var", async () => {
      const originalXdg = process.env.XDG_CONFIG_HOME
      process.env.XDG_CONFIG_HOME = undefined

      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => {
        expect(process.env.XDG_CONFIG_HOME).toBe("/tmp/test-dir")
        return ctx
      })

      process.env.XDG_CONFIG_HOME = originalXdg
    })

    it("restores XDG_CONFIG_HOME after run", async () => {
      const originalXdg = process.env.XDG_CONFIG_HOME
      process.env.XDG_CONFIG_HOME = "/original/xdg"

      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => ctx)

      expect(process.env.XDG_CONFIG_HOME).toBe("/original/xdg")

      process.env.XDG_CONFIG_HOME = originalXdg
    })

    it("sets GH_TOKEN from previous GH_TOKEN if available", async () => {
      const originalToken = process.env.GH_TOKEN
      process.env.GH_TOKEN = "original-token"
      process.env.GITHUB_TOKEN = undefined

      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => {
        expect(process.env.GH_TOKEN).toBe("original-token")
        return ctx
      })

      process.env.GH_TOKEN = originalToken
    })

    it("restores GH_TOKEN after run", async () => {
      const originalToken = process.env.GH_TOKEN
      process.env.GH_TOKEN = "test-token"

      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => ctx)

      expect(process.env.GH_TOKEN).toBe("test-token")

      process.env.GH_TOKEN = originalToken
    })

    it("prepends benchmark bin dir to PATH when mode is 'ghx'", async () => {
      const originalPath = process.env.PATH
      process.env.PATH = "/usr/bin:/bin"

      mocks.lstatMock.mockResolvedValue({})

      await withIsolatedBenchmarkClient("ghx", "openai", "gpt-4", async (ctx) => {
        expect(process.env.PATH).toMatch(/benchmark/)
        return ctx
      })

      process.env.PATH = originalPath
    })

    it("restores PATH after run", async () => {
      const originalPath = process.env.PATH
      process.env.PATH = "/original/path"

      mocks.lstatMock.mockResolvedValue({})

      await withIsolatedBenchmarkClient("ghx", "openai", "gpt-4", async (ctx) => ctx)

      expect(process.env.PATH).toBe("/original/path")

      process.env.PATH = originalPath
    })

    it("returns result from run callback", async () => {
      const result = { foo: "bar" }
      const returnValue = await withIsolatedBenchmarkClient(
        "agent_direct",
        "openai",
        "gpt-4",
        async (_ctx) => result,
      )

      expect(returnValue).toEqual(result)
    })

    it("cleans up even when run callback throws", async () => {
      await expect(
        withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (_ctx) => {
          throw new Error("callback error")
        }),
      ).rejects.toThrow("callback error")

      expect(mocks.rmMock).toHaveBeenCalled()
    })

    it("chdirs to BENCH_SESSION_WORKDIR when set", async () => {
      const original = process.env.BENCH_SESSION_WORKDIR
      process.env.BENCH_SESSION_WORKDIR = "/Users/aryekogan/repos/ghx-bench-fixtures"

      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => ctx)

      expect(chdirSpy).toHaveBeenCalledWith("/Users/aryekogan/repos/ghx-bench-fixtures")

      process.env.BENCH_SESSION_WORKDIR = original
    })

    it("does not chdir when BENCH_SESSION_WORKDIR is not set", async () => {
      const original = process.env.BENCH_SESSION_WORKDIR
      delete process.env.BENCH_SESSION_WORKDIR

      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => ctx)

      expect(chdirSpy).not.toHaveBeenCalled()

      process.env.BENCH_SESSION_WORKDIR = original
    })

    it("restores original cwd after run", async () => {
      const originalCwd = process.cwd()
      const original = process.env.BENCH_SESSION_WORKDIR
      process.env.BENCH_SESSION_WORKDIR = "/Users/aryekogan/repos/ghx-bench-fixtures"

      await withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => ctx)

      expect(chdirSpy).toHaveBeenLastCalledWith(originalCwd)

      process.env.BENCH_SESSION_WORKDIR = original
    })

    it("restores original cwd even when createOpencode throws", async () => {
      const originalCwd = process.cwd()
      const original = process.env.BENCH_SESSION_WORKDIR
      process.env.BENCH_SESSION_WORKDIR = "/Users/aryekogan/repos/ghx-bench-fixtures"
      mocks.createOpencodeMock.mockRejectedValue(new Error("opencode failed"))

      await expect(
        withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => ctx),
      ).rejects.toThrow("opencode failed")

      expect(chdirSpy).toHaveBeenLastCalledWith(originalCwd)

      process.env.BENCH_SESSION_WORKDIR = original
    })

    it("throws benchmark_session_workdir_invalid and calls teardown when process.chdir fails", async () => {
      const original = process.env.BENCH_SESSION_WORKDIR
      process.env.BENCH_SESSION_WORKDIR = "/nonexistent/path"
      chdirSpy.mockImplementationOnce(() => {
        throw new Error("ENOENT: no such file or directory")
      })

      await expect(
        withIsolatedBenchmarkClient("agent_direct", "openai", "gpt-4", async (ctx) => ctx),
      ).rejects.toThrow("benchmark_session_workdir_invalid")

      // teardown ran: temp dir should be cleaned up
      expect(mocks.rmMock).toHaveBeenCalled()

      process.env.BENCH_SESSION_WORKDIR = original
    })
  })

  describe("openBenchmarkClient", () => {
    it("returns client, systemInstruction, and close function", async () => {
      const result = await openBenchmarkClient("agent_direct", "openai", "gpt-4")

      expect(result).toHaveProperty("client")
      expect(result).toHaveProperty("systemInstruction")
      expect(result).toHaveProperty("close")
      expect(typeof result.close).toBe("function")
    })

    it("returns the system instruction from mode instructions", async () => {
      const result = await openBenchmarkClient("agent_direct", "openai", "gpt-4")

      expect(result.systemInstruction).toBe("Use GitHub CLI")
    })

    it("does not close server until close() is called", async () => {
      const closeMock = vi.fn()
      mocks.createOpencodeMock.mockResolvedValue({
        server: { close: closeMock },
        client: {
          session: {
            create: vi.fn().mockResolvedValue({ data: { id: "session-1" } }),
            promptAsync: vi.fn().mockResolvedValue({}),
            messages: vi.fn().mockResolvedValue({ data: [] }),
            abort: vi.fn().mockResolvedValue({}),
          },
          config: {
            get: vi.fn().mockResolvedValue({
              data: { instructions: [], plugin: [] },
            }),
          },
        },
      })

      const { close } = await openBenchmarkClient("agent_direct", "openai", "gpt-4")

      expect(closeMock).not.toHaveBeenCalled()

      await close()

      expect(closeMock).toHaveBeenCalled()
    })

    it("cleans up temp directory when close() is called", async () => {
      const { close } = await openBenchmarkClient("agent_direct", "openai", "gpt-4")

      expect(mocks.rmMock).not.toHaveBeenCalled()

      await close()

      expect(mocks.rmMock).toHaveBeenCalledWith("/tmp/test-dir", {
        recursive: true,
        force: true,
      })
    })

    it("cleans up immediately if createOpencode throws", async () => {
      mocks.createOpencodeMock.mockRejectedValue(new Error("opencode failed"))

      await expect(openBenchmarkClient("agent_direct", "openai", "gpt-4")).rejects.toThrow(
        "opencode failed",
      )

      expect(mocks.rmMock).toHaveBeenCalled()
    })
  })
})
