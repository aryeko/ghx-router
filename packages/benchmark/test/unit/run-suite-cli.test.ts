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
            scenarioSet: "ci-verify-pr",
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
            gate: { command: ["pnpm", "run", "report", "--", "--gate", "--gate-profile", "verify_pr"] },
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
            Buffer.from(`${JSON.stringify({ event: "scenario_finished", completed: 2, total: 5 })}\n`, "utf8"),
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
      "ci-verify-pr",
    ])

    expect(directCall?.[0]).toBe("pnpm")
    expect(directCall?.[1]).toEqual([
      "run",
      "benchmark",
      "--",
      "agent_direct",
      "3",
      "--scenario-set",
      "ci-verify-pr",
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
          base: { command: ["pnpm", "run", "benchmark", "--"], repetitions: 3, scenarioSet: "ci-verify-pr" },
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
})
