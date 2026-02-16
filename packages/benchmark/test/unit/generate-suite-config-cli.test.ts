import { beforeEach, describe, expect, it, vi } from "vitest"
import { mkdtemp, readFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("generate-suite-config cli", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("generates grouped config with benchmark base and per-mode extensions", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-config-"))
    const outPath = join(root, "suite-runner.json")

    const mod = await import("../../src/cli/generate-suite-config.js")
    await mod.main([
      "--out",
      outPath,
      "--scenario-set",
      "ci-verify-pr",
      "--repetitions",
      "4",
      "--gate-profile",
      "verify_release",
      "--with-cleanup",
      "--with-seed",
    ])

    const raw = await readFile(outPath, "utf8")
    const parsed = JSON.parse(raw) as Record<string, unknown>

    expect(parsed.fixtures).toBeDefined()
    expect(parsed.benchmark).toBeDefined()
    expect(parsed.reporting).toBeDefined()

    const benchmark = parsed.benchmark as Record<string, unknown>
    const base = benchmark.base as Record<string, unknown>
    const ghx = benchmark.ghx as Record<string, unknown>
    const direct = benchmark.direct as Record<string, unknown>

    expect(base.command).toEqual(["pnpm", "run", "benchmark", "--"])
    expect(base.repetitions).toBe(4)
    expect(base.scenarioSet).toBe("ci-verify-pr")
    expect(ghx.mode).toBe("ghx")
    expect(direct.mode).toBe("agent_direct")
    expect((ghx.env as Record<string, unknown>)?.BENCH_OPENCODE_PORT).toBe("3001")
    expect((direct.env as Record<string, unknown>)?.BENCH_OPENCODE_PORT).toBe("3002")

    const reporting = parsed.reporting as Record<string, unknown>
    const analysis = reporting.analysis as Record<string, unknown>
    const gate = analysis.gate as Record<string, unknown>
    expect(gate.command).toEqual([
      "pnpm",
      "run",
      "report",
      "--",
      "--gate",
      "--gate-profile",
      "verify_release",
    ])
  })

  it("supports skip setup and no-gate generation", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-config-"))
    const outPath = join(root, "suite-runner.json")

    const mod = await import("../../src/cli/generate-suite-config.js")
    await mod.main(["--out", outPath, "--skip-cleanup", "--skip-seed", "--no-gate"])

    const raw = await readFile(outPath, "utf8")
    const parsed = JSON.parse(raw) as {
      fixtures?: { setup?: { cleanup?: unknown; seed?: unknown } }
      reporting?: { analysis?: { gate?: unknown } }
    }

    expect(parsed.fixtures?.setup?.cleanup).toBeUndefined()
    expect(parsed.fixtures?.setup?.seed).toBeUndefined()
    expect(parsed.reporting?.analysis?.gate).toBeUndefined()
  })

  it("omits setup by default", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-suite-config-"))
    const outPath = join(root, "suite-runner.json")

    const mod = await import("../../src/cli/generate-suite-config.js")
    await mod.main(["--out", outPath])

    const raw = await readFile(outPath, "utf8")
    const parsed = JSON.parse(raw) as {
      fixtures?: { setup?: { cleanup?: unknown; seed?: unknown } }
    }

    expect(parsed.fixtures?.setup?.cleanup).toBeUndefined()
    expect(parsed.fixtures?.setup?.seed).toBeUndefined()
  })
})
