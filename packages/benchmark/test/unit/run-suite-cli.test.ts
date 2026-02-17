import { EventEmitter } from "node:events"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { spawnMock, createLogUpdateMock, logUpdateRenderMock, logUpdateDoneMock } = vi.hoisted(
  () => ({
    spawnMock: vi.fn(),
    createLogUpdateMock: vi.fn(),
    logUpdateRenderMock: vi.fn(),
    logUpdateDoneMock: vi.fn(),
  }),
)

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}))

vi.mock("log-update", () => {
  return {
    createLogUpdate: createLogUpdateMock,
  }
})

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

function setStdoutTTY(value: boolean): () => void {
  const previous = Object.getOwnPropertyDescriptor(process.stdout, "isTTY")
  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value,
  })

  return () => {
    if (previous) {
      Object.defineProperty(process.stdout, "isTTY", previous)
      return
    }
    delete (process.stdout as { isTTY?: boolean }).isTTY
  }
}

function stripAnsi(value: string): string {
  let output = ""
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === "\u001b" && value[index + 1] === "[") {
      while (index < value.length && value[index] !== "m") {
        index += 1
      }
      continue
    }
    output += char
  }

  return output
}

describe("run-suite cli", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createLogUpdateMock.mockImplementation(() => {
      const render = logUpdateRenderMock as typeof logUpdateRenderMock & { done?: () => void }
      render.done = logUpdateDoneMock
      return render
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("runs grouped setup, benchmark pair, reporting report, and gate from config", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")

    await writeFile(
      configPath,
      `${JSON.stringify({
        fixtures: {
          setup: {
            cleanup: { command: ["cleanup", "--fast"] },
            seed: { command: ["seed", "--fixtures"] },
          },
        },
        benchmark: {
          base: {
            command: ["pnpm", "run", "benchmark", "--"],
            repetitions: 3,
            scenarioSet: "default",
          },
          ghx: {
            mode: "ghx",
            env: { GHX_SKIP_GH_PREFLIGHT: "1" },
          },
          direct: {
            mode: "agent_direct",
          },
        },
        reporting: {
          analysis: {
            report: { command: ["pnpm", "run", "report"] },
            gate: {
              command: ["pnpm", "run", "report", "--", "--gate", "--gate-profile", "verify_pr"],
            },
          },
        },
      })}\n`,
      "utf8",
    )

    spawnMock.mockImplementation((command: string) => {
      const child = createMockChild()
      queueMicrotask(() => {
        if (command === "pnpm") {
          child.stdout.emit(
            "data",
            Buffer.from(
              `${JSON.stringify({ event: "scenario_finished", completed: 2, total: 5 })}\n`,
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

    const calls = spawnMock.mock.calls as unknown[][]
    expect(calls).toHaveLength(6)

    expect(calls[0]?.[0]).toBe("cleanup")
    expect(calls[1]?.[0]).toBe("seed")
    const seedOptions = calls[1]?.[2] as { env?: Record<string, string | undefined> } | undefined
    expect(seedOptions?.env?.BENCH_FIXTURE_SEED_ID).toMatch(/^suite-seed-/)

    const ghxCall = calls[2]
    const directCall = calls[3]

    expect(ghxCall?.[0]).toBe("pnpm")
    expect(ghxCall?.[1]).toEqual([
      "run",
      "benchmark",
      "--",
      "ghx",
      "3",
      "--scenario-set",
      "default",
    ])

    expect(directCall?.[0]).toBe("pnpm")
    expect(directCall?.[1]).toEqual([
      "run",
      "benchmark",
      "--",
      "agent_direct",
      "3",
      "--scenario-set",
      "default",
    ])

    const ghxOptions = ghxCall?.[2] as { env?: Record<string, string | undefined> }
    const directOptions = directCall?.[2] as { env?: Record<string, string | undefined> }

    expect(ghxOptions.env?.BENCH_PROGRESS_EVENTS).toBe("jsonl")
    expect(directOptions.env?.BENCH_PROGRESS_EVENTS).toBe("jsonl")
    expect(ghxOptions.env?.GHX_SKIP_GH_PREFLIGHT).toBe("1")

    expect(calls[4]?.[0]).toBe("pnpm")
    expect(calls[4]?.[1]).toEqual(["run", "report"])
    expect(calls[5]?.[0]).toBe("pnpm")
    expect(calls[5]?.[1]).toEqual(["run", "report", "--", "--gate", "--gate-profile", "verify_pr"])
  })

  it("preserves explicit BENCH_FIXTURE_SEED_ID on seed command", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")

    await writeFile(
      configPath,
      `${JSON.stringify({
        fixtures: {
          setup: {
            seed: {
              command: ["seed", "--fixtures"],
              env: {
                BENCH_FIXTURE_SEED_ID: "fixed-seed-id",
              },
            },
          },
        },
        benchmark: {
          base: {
            command: ["pnpm", "run", "benchmark", "--"],
            repetitions: 3,
          },
          ghx: {
            mode: "ghx",
          },
          direct: {
            mode: "agent_direct",
          },
        },
        reporting: {
          analysis: {
            report: { command: ["pnpm", "run", "report"] },
          },
        },
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
    await expect(mod.main(["--config", configPath, "--no-gate"])).resolves.toBeUndefined()

    const calls = spawnMock.mock.calls as unknown[][]
    const seedCall = calls.find((call) => call[0] === "seed")
    const seedOptions = seedCall?.[2] as { env?: Record<string, string | undefined> } | undefined
    expect(seedOptions?.env?.BENCH_FIXTURE_SEED_ID).toBe("fixed-seed-id")
  })

  it("kills peer benchmark process when one side fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")

    await writeFile(
      configPath,
      `${JSON.stringify({
        benchmark: {
          base: {
            command: ["pnpm", "run", "benchmark", "--"],
            repetitions: 3,
            scenarioSet: "default",
          },
          ghx: { mode: "ghx" },
          direct: { mode: "agent_direct" },
        },
        reporting: {
          analysis: {
            report: { command: ["pnpm", "run", "report"] },
          },
        },
      })}\n`,
      "utf8",
    )

    const ghxChild = createMockChild()
    const directChild = createMockChild()

    let benchSpawnCount = 0
    spawnMock.mockImplementation((command: string, args?: string[]) => {
      if (command === "pnpm" && Array.isArray(args) && args.includes("benchmark")) {
        benchSpawnCount += 1
        if (benchSpawnCount === 1) {
          queueMicrotask(() => {
            ghxChild.emit("exit", 0, null)
          })
          return ghxChild
        }

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
    expect(spawnedCommands.slice(-1)[0]).not.toBe("report")
  })

  it("supports phase override flags to skip setup and gate", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")

    await writeFile(
      configPath,
      `${JSON.stringify({
        fixtures: {
          setup: {
            cleanup: { command: ["cleanup"] },
            seed: { command: ["seed"] },
          },
        },
        benchmark: {
          base: { command: ["pnpm", "run", "benchmark", "--"], repetitions: 3 },
          ghx: { mode: "ghx" },
          direct: { mode: "agent_direct" },
        },
        reporting: {
          analysis: {
            report: { command: ["pnpm", "run", "report"] },
            gate: { command: ["pnpm", "run", "report", "--", "--gate"] },
          },
        },
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
    expect(spawnedCommands).toEqual(["pnpm", "pnpm", "pnpm"])

    const args = (spawnMock.mock.calls as unknown[][]).map((call) => call[1])
    expect(args).toEqual([
      ["run", "benchmark", "--", "ghx", "3"],
      ["run", "benchmark", "--", "agent_direct", "3"],
      ["run", "report"],
    ])
  })

  it("appends variant-specific benchmark args to spawned commands", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")

    await writeFile(
      configPath,
      `${JSON.stringify({
        benchmark: {
          base: { command: ["pnpm", "run", "benchmark", "--"], repetitions: 2 },
          ghx: { mode: "ghx", args: ["--profile", "verify_pr"] },
          direct: { mode: "agent_direct", args: ["--timeout", "120"] },
        },
        reporting: {
          analysis: {
            report: { command: ["pnpm", "run", "report"] },
          },
        },
      })}\n`,
      "utf8",
    )

    spawnMock.mockImplementation(() => {
      const child = createMockChild()
      queueMicrotask(() => child.emit("exit", 0, null))
      return child
    })

    const mod = await import("../../src/cli/run-suite.js")
    await expect(mod.main(["--config", configPath, "--no-gate"])).resolves.toBeUndefined()

    const calls = spawnMock.mock.calls as unknown[][]
    expect(calls[0]?.[1]).toEqual(["run", "benchmark", "--", "ghx", "2", "--profile", "verify_pr"])
    expect(calls[1]?.[1]).toEqual([
      "run",
      "benchmark",
      "--",
      "agent_direct",
      "2",
      "--timeout",
      "120",
    ])
  })

  it("reports ghx benchmark failure when ghx exits non-zero", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")

    await writeFile(
      configPath,
      `${JSON.stringify({
        benchmark: {
          base: { command: ["pnpm", "run", "benchmark", "--"], repetitions: 1 },
          ghx: { mode: "ghx" },
          direct: { mode: "agent_direct" },
        },
        reporting: {
          analysis: {
            report: { command: ["pnpm", "run", "report"] },
          },
        },
      })}\n`,
      "utf8",
    )

    const ghxChild = createMockChild()
    const directChild = createMockChild()
    let benchSpawnCount = 0

    spawnMock.mockImplementation((command: string, args?: string[]) => {
      if (command === "pnpm" && Array.isArray(args) && args.includes("benchmark")) {
        benchSpawnCount += 1

        if (benchSpawnCount === 1) {
          queueMicrotask(() => {
            ghxChild.stderr.emit("data", Buffer.from("ghx benchmark failed\n", "utf8"))
            ghxChild.emit("exit", 2, null)
          })
          return ghxChild
        }

        queueMicrotask(() => {
          directChild.emit("exit", 0, null)
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
    await expect(mod.main(["--config", configPath])).rejects.toThrow("ghx phase failed (code=2)")

    expect(directChild.kill).toHaveBeenCalledWith("SIGTERM")
  })

  it("parses --verbose flag", async () => {
    const mod = await import("../../src/cli/run-suite.js")
    const parsed = mod.parseArgs(["--config", "x.json", "--verbose"])
    expect(parsed.verbose).toBe(true)
  })

  it("parses inline config flag and gate precedence", async () => {
    const mod = await import("../../src/cli/run-suite.js")
    const parsed = mod.parseArgs(["--", "--config=custom/suite.json", "--gate", "--no-gate"])

    expect(parsed.configPath).toBe("custom/suite.json")
    expect(parsed.runGate).toBe(true)
    expect(parsed.skipCleanup).toBe(false)
    expect(parsed.skipSeed).toBe(false)
  })

  it("falls back to default args when optional flags are omitted", async () => {
    const mod = await import("../../src/cli/run-suite.js")
    expect(mod.parseArgs([])).toEqual({
      configPath: "config/suite-runner.json",
      skipCleanup: false,
      skipSeed: false,
      runGate: null,
      verbose: false,
    })
  })

  it("throws when suite config json is invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")
    await writeFile(configPath, "{", "utf8")

    const mod = await import("../../src/cli/run-suite.js")
    await expect(mod.loadSuiteRunnerConfig(configPath)).rejects.toThrow()
  })

  it("throws when suite config does not satisfy schema", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")
    await writeFile(
      configPath,
      `${JSON.stringify({
        benchmark: {
          base: { command: ["pnpm"], repetitions: 1 },
          ghx: { mode: "ghx" },
          direct: { mode: "agent_direct" },
        },
      })}\n`,
      "utf8",
    )

    const mod = await import("../../src/cli/run-suite.js")
    await expect(mod.loadSuiteRunnerConfig(configPath)).rejects.toThrow()
  })

  it("streams child output only in verbose mode", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")

    await writeFile(
      configPath,
      `${JSON.stringify({
        benchmark: {
          base: { command: ["pnpm", "run", "benchmark", "--"], repetitions: 1 },
          ghx: { mode: "ghx" },
          direct: { mode: "agent_direct" },
        },
        reporting: {
          analysis: {
            report: { command: ["pnpm", "run", "report"] },
          },
        },
      })}\n`,
      "utf8",
    )

    spawnMock.mockImplementation((command: string, args?: string[]) => {
      const child = createMockChild()
      queueMicrotask(() => {
        if (command === "pnpm" && Array.isArray(args) && args.includes("report")) {
          child.stdout.emit("data", Buffer.from("report-output\n", "utf8"))
        }
        child.emit("exit", 0, null)
      })
      return child
    })

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    const mod = await import("../../src/cli/run-suite.js")
    await expect(mod.main(["--config", configPath, "--no-gate"])).resolves.toBeUndefined()
    expect(logSpy).not.toHaveBeenCalledWith("[report] report-output")

    logSpy.mockClear()
    await expect(
      mod.main(["--config", configPath, "--no-gate", "--verbose"]),
    ).resolves.toBeUndefined()
    expect(logSpy).toHaveBeenCalledWith("[report] report-output")
  })

  it("throws if --gate is requested but gate command is missing from config", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")
    await writeFile(
      configPath,
      `${JSON.stringify({
        benchmark: {
          base: { command: ["pnpm", "run", "benchmark", "--"], repetitions: 1 },
          ghx: { mode: "ghx" },
          direct: { mode: "agent_direct" },
        },
        reporting: {
          analysis: {
            report: { command: ["pnpm", "run", "report"] },
          },
        },
      })}\n`,
      "utf8",
    )

    spawnMock.mockImplementation(() => {
      const child = createMockChild()
      queueMicrotask(() => child.emit("exit", 0, null))
      return child
    })

    const mod = await import("../../src/cli/run-suite.js")
    await expect(mod.main(["--config", configPath, "--gate"])).rejects.toThrow(
      "Gate requested but no gate command configured",
    )
  })

  it("includes recent stderr output in phase failure errors", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")
    await writeFile(
      configPath,
      `${JSON.stringify({
        fixtures: {
          setup: {
            cleanup: { command: ["cleanup"] },
          },
        },
        benchmark: {
          base: { command: ["pnpm", "run", "benchmark", "--"], repetitions: 1 },
          ghx: { mode: "ghx" },
          direct: { mode: "agent_direct" },
        },
        reporting: {
          analysis: {
            report: { command: ["pnpm", "run", "report"] },
          },
        },
      })}\n`,
      "utf8",
    )

    spawnMock.mockImplementation((command: string) => {
      const child = createMockChild()
      queueMicrotask(() => {
        if (command === "cleanup") {
          child.stderr.emit("data", Buffer.from("cleanup failed\n", "utf8"))
          child.emit("exit", 7, null)
          return
        }
        child.emit("exit", 0, null)
      })
      return child
    })

    const mod = await import("../../src/cli/run-suite.js")
    await expect(mod.main(["--config", configPath])).rejects.toThrow(
      "recent output:\ncleanup failed",
    )
  })

  it("treats child process error events as command failures", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")
    await writeFile(
      configPath,
      `${JSON.stringify({
        fixtures: {
          setup: {
            cleanup: { command: ["cleanup", "--quick"] },
          },
        },
        benchmark: {
          base: { command: ["pnpm", "run", "benchmark", "--"], repetitions: 1 },
          ghx: { mode: "ghx" },
          direct: { mode: "agent_direct" },
        },
        reporting: {
          analysis: {
            report: { command: ["pnpm", "run", "report"] },
          },
        },
      })}\n`,
      "utf8",
    )

    spawnMock.mockImplementation((command: string) => {
      const child = createMockChild()
      queueMicrotask(() => {
        if (command === "cleanup") {
          child.emit("error", new Error("spawn failure"))
          return
        }
        child.emit("exit", 0, null)
      })
      return child
    })

    const mod = await import("../../src/cli/run-suite.js")
    await expect(mod.main(["--config", configPath])).rejects.toThrow(
      "recent output:\nspawn failure",
    )
  })

  it("passes config cwd to spawned commands", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const execCwd = join(root, "workspace")
    const configPath = join(root, "suite-runner.json")
    await writeFile(
      configPath,
      `${JSON.stringify({
        cwd: execCwd,
        benchmark: {
          base: { command: ["pnpm", "run", "benchmark", "--"], repetitions: 1 },
          ghx: { mode: "ghx" },
          direct: { mode: "agent_direct" },
        },
        reporting: {
          analysis: {
            report: { command: ["pnpm", "run", "report"] },
          },
        },
      })}\n`,
      "utf8",
    )

    spawnMock.mockImplementation(() => {
      const child = createMockChild()
      queueMicrotask(() => child.emit("exit", 0, null))
      return child
    })

    const mod = await import("../../src/cli/run-suite.js")
    await expect(mod.main(["--config", configPath, "--no-gate"])).resolves.toBeUndefined()

    const spawnOptions = (spawnMock.mock.calls as unknown[][]).map(
      (call) => call[2] as { cwd?: string },
    )
    for (const options of spawnOptions) {
      expect(options.cwd).toBe(execCwd)
    }
  })

  it("renders and stops interactive dashboard in tty mode", async () => {
    const restoreTTY = setStdoutTTY(true)
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")
    await writeFile(
      configPath,
      `${JSON.stringify({
        benchmark: {
          base: { command: ["pnpm", "run", "benchmark", "--"], repetitions: 1 },
          ghx: { mode: "ghx" },
          direct: { mode: "agent_direct" },
        },
        reporting: {
          analysis: {
            report: { command: ["pnpm", "run", "report"] },
          },
        },
      })}\n`,
      "utf8",
    )

    spawnMock.mockImplementation(() => {
      const child = createMockChild()
      queueMicrotask(() => child.emit("exit", 0, null))
      return child
    })

    try {
      const mod = await import("../../src/cli/run-suite.js")
      await expect(mod.main(["--config", configPath, "--no-gate"])).resolves.toBeUndefined()
    } finally {
      restoreTTY()
    }

    expect(createLogUpdateMock).toHaveBeenCalled()
    expect(logUpdateRenderMock).toHaveBeenCalled()
    expect(logUpdateDoneMock).toHaveBeenCalledOnce()
  })

  it("pads benchmark labels before colorization for deterministic alignment", async () => {
    const restoreTTY = setStdoutTTY(true)
    const previousNoColor = process.env.NO_COLOR
    delete process.env.NO_COLOR

    const root = await mkdtemp(join(tmpdir(), "ghx-suite-cli-"))
    const configPath = join(root, "suite-runner.json")
    await writeFile(
      configPath,
      `${JSON.stringify({
        benchmark: {
          base: { command: ["pnpm", "run", "benchmark", "--"], repetitions: 1 },
          ghx: { mode: "ghx" },
          direct: { mode: "agent_direct" },
        },
        reporting: {
          analysis: {
            report: { command: ["pnpm", "run", "report"] },
          },
        },
      })}\n`,
      "utf8",
    )

    spawnMock.mockImplementation(() => {
      const child = createMockChild()
      queueMicrotask(() => child.emit("exit", 0, null))
      return child
    })

    try {
      const mod = await import("../../src/cli/run-suite.js")
      await expect(mod.main(["--config", configPath, "--no-gate"])).resolves.toBeUndefined()
    } finally {
      restoreTTY()
      if (previousNoColor === undefined) {
        delete process.env.NO_COLOR
      } else {
        process.env.NO_COLOR = previousNoColor
      }
    }

    const renders = logUpdateRenderMock.mock.calls
      .map((call) => call[0])
      .filter((value): value is string => typeof value === "string")
      .map(stripAnsi)

    const pendingRows = renders
      .flatMap((frame) => frame.split("\n"))
      .filter((line) => {
        return line.includes("ghx") && line.includes("pending")
      })

    expect(pendingRows.length).toBeGreaterThan(0)
    expect(pendingRows[0]).toMatch(/^\s{2}ghx\s{5}○ pending$/)
  })
})
