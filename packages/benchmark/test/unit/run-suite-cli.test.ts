import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { EventEmitter } from "node:events"

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}))

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}))

type MockChild = EventEmitter & {
  stdout: EventEmitter
  stderr: EventEmitter
  kill: ReturnType<typeof vi.fn>
}

function createMockChild(): MockChild {
  const child = new EventEmitter() as MockChild
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = vi.fn(() => true)
  return child
}

describe("run-suite cli", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("runs cleanup, seed, benchmark pair, report, and gate from config", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")

    await writeFile(
      configPath,
      `${JSON.stringify({
        cleanup: { command: ["cleanup", "--fast"] },
        seed: { command: ["seed", "--fixtures"] },
        benchmark: {
          ghx: { command: ["bench-ghx", "--set", "ci-verify-pr"] },
          direct: { command: ["bench-direct", "--set", "ci-verify-pr"] },
        },
        report: { command: ["report", "--latest"] },
        gate: { command: ["report", "--gate", "--gate-profile", "verify_pr"] },
      })}\n`,
      "utf8",
    )

    spawnMock.mockImplementation((command: string, args?: string[]) => {
      const child = createMockChild()
      queueMicrotask(() => {
        if (command === "bench-ghx" || command === "bench-direct") {
          child.stdout.emit(
            "data",
            Buffer.from('{"type":"progress","completed":2,"total":5}\n', "utf8"),
          )
        }
        child.emit("exit", 0, null)
      })
      return child
    })

    const mod = await import("../../src/cli/run-suite.js")
    await expect(mod.main(["--config", configPath])).resolves.toBeUndefined()

    expect(spawnMock).toHaveBeenCalledTimes(6)

    const calls = spawnMock.mock.calls as unknown[][]
    const ghxCall = calls.find((call) => call[0] === "bench-ghx")
    const directCall = calls.find((call) => call[0] === "bench-direct")

    const ghxOptions = ghxCall?.[2] as { env?: Record<string, string | undefined> }
    const directOptions = directCall?.[2] as { env?: Record<string, string | undefined> }

    expect(ghxOptions.env?.BENCH_PROGRESS_EVENTS).toBe("jsonl")
    expect(directOptions.env?.BENCH_PROGRESS_EVENTS).toBe("jsonl")
  })

  it("kills peer benchmark process when one side fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")

    await writeFile(
      configPath,
      `${JSON.stringify({
        benchmark: {
          ghx: { command: ["bench-ghx"] },
          direct: { command: ["bench-direct"] },
        },
        report: { command: ["report", "--latest"] },
      })}\n`,
      "utf8",
    )

    const ghxChild = createMockChild()
    const directChild = createMockChild()

    spawnMock.mockImplementation((command: string) => {
      if (command === "bench-ghx") {
        queueMicrotask(() => {
          ghxChild.emit("exit", 0, null)
        })
        return ghxChild
      }

      if (command === "bench-direct") {
        queueMicrotask(() => {
          directChild.emit("exit", 1, null)
        })
        return directChild
      }

      const child = createMockChild()
      queueMicrotask(() => {
        child.emit("exit", 0, null)
      })
      return child
    })

    const mod = await import("../../src/cli/run-suite.js")
    await expect(mod.main(["--config", configPath])).rejects.toThrow("benchmark")

    expect(ghxChild.kill).toHaveBeenCalledWith("SIGTERM")
    const spawnedCommands = (spawnMock.mock.calls as unknown[][]).map((call) => call[0])
    expect(spawnedCommands).not.toContain("report")
  })

  it("falls back to plain status output for non-tty", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")

    await writeFile(
      configPath,
      `${JSON.stringify({
        benchmark: {
          ghx: { command: ["bench-ghx"] },
          direct: { command: ["bench-direct"] },
        },
        report: { command: ["report"] },
      })}\n`,
      "utf8",
    )

    const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY")
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: false,
    })

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    spawnMock.mockImplementation(() => {
      const child = createMockChild()
      queueMicrotask(() => {
        child.emit("exit", 0, null)
      })
      return child
    })

    const mod = await import("../../src/cli/run-suite.js")
    await expect(mod.main(["--config", configPath])).resolves.toBeUndefined()

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("benchmark"))

    if (ttyDescriptor) {
      Object.defineProperty(process.stdout, "isTTY", ttyDescriptor)
    }
  })

  it("supports phase override flags to skip cleanup/seed/gate", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")

    await writeFile(
      configPath,
      `${JSON.stringify({
        cleanup: { command: ["cleanup"] },
        seed: { command: ["seed"] },
        benchmark: {
          ghx: { command: ["bench-ghx"] },
          direct: { command: ["bench-direct"] },
        },
        report: { command: ["report"] },
        gate: { command: ["gate"] },
      })}\n`,
      "utf8",
    )

    spawnMock.mockImplementation(() => {
      const child = createMockChild()
      queueMicrotask(() => {
        child.emit("exit", 0, null)
      })
      return child
    })

    const mod = await import("../../src/cli/run-suite.js")
    await expect(
      mod.main(["--config", configPath, "--skip-cleanup", "--skip-seed", "--no-gate"]),
    ).resolves.toBeUndefined()

    const spawnedCommands = (spawnMock.mock.calls as unknown[][]).map((call) => call[0])
    expect(spawnedCommands).toEqual(["bench-ghx", "bench-direct", "report"])
  })

  it("updates tty progress bars from structured scenario_finished events", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")

    await writeFile(
      configPath,
      `${JSON.stringify({
        benchmark: {
          ghx: { command: ["bench-ghx"] },
          direct: { command: ["bench-direct"] },
        },
        report: { command: ["report"] },
      })}\n`,
      "utf8",
    )

    const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY")
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: true,
    })

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    spawnMock.mockImplementation((command: string) => {
      const child = createMockChild()
      queueMicrotask(() => {
        if (command === "bench-ghx") {
          child.stdout.emit(
            "data",
            Buffer.from(
              `${JSON.stringify({ event: "scenario_finished", mode: "ghx", completed: 1, total: 2 })}\n`,
              "utf8",
            ),
          )
        }

        if (command === "bench-direct") {
          child.stdout.emit(
            "data",
            Buffer.from(
              `${JSON.stringify({ event: "scenario_finished", mode: "agent_direct", completed: 2, total: 2 })}\n`,
              "utf8",
            ),
          )
        }
        child.emit("exit", 0, null)
      })
      return child
    })

    const mod = await import("../../src/cli/run-suite.js")
    await expect(mod.main(["--config", configPath])).resolves.toBeUndefined()

    const loggedLines = logSpy.mock.calls
      .map((call) => call[0])
      .filter((line): line is string => typeof line === "string")

    expect(loggedLines.some((line) => line.includes("ghx") && line.includes("1/2"))).toBe(true)
    expect(loggedLines.some((line) => line.includes("direct") && line.includes("2/2"))).toBe(true)

    if (ttyDescriptor) {
      Object.defineProperty(process.stdout, "isTTY", ttyDescriptor)
    }
    logSpy.mockRestore()
  })
})
