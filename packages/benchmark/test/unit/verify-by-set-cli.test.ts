import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import {
  parseArgs,
  resolveSeedPolicy,
  runVerifySet,
  validateSuiteRows,
} from "@bench/cli/verify-by-set.js"
import { describe, expect, it, vi } from "vitest"

type SuiteConfig = {
  benchmark: {
    base: {
      command: string[]
      repetitions: number
      scenarioSet?: string
      env?: Record<string, string>
    }
    ghx: { mode: "ghx"; args?: string[] }
    direct: { mode: "agent_direct"; args?: string[] }
  }
  reporting: {
    analysis: {
      report: { command: string[] }
      gate?: { command: string[] }
    }
  }
}

function findFlagValue(args: string[], flag: string): string | null {
  const index = args.findIndex((value) => value === flag)
  return index === -1 ? null : (args[index + 1] ?? null)
}

async function writeBaseSuiteConfig(path: string): Promise<void> {
  const config = {
    benchmark: {
      base: {
        command: ["pnpm", "run", "benchmark", "--"],
        repetitions: 1,
        scenarioSet: "default",
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
        report: {
          command: ["pnpm", "run", "report"],
        },
      },
    },
  } satisfies SuiteConfig

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8")
}

function outputPathFromModeArgs(args: string[] | undefined): string {
  if (!args) {
    throw new Error("missing mode args")
  }

  const path = findFlagValue(args, "--output-jsonl")
  if (!path) {
    throw new Error("missing --output-jsonl")
  }
  return path
}

function reportSummaryPaths(command: string[]): { summaryJson: string; summaryMd: string } {
  const summaryJson = findFlagValue(command, "--summary-json")
  const summaryMd = findFlagValue(command, "--summary-md")
  if (!summaryJson || !summaryMd) {
    throw new Error("missing summary outputs")
  }
  return { summaryJson, summaryMd }
}

describe("verify-by-set cli", () => {
  it("parses required args and defaults", () => {
    const parsed = parseArgs(["--set", "pr-exec", "--provider", "openai"])

    expect(parsed.set).toBe("pr-exec")
    expect(parsed.provider).toBe("openai")
    expect(parsed.model).toBe("gpt-5.1-codex-mini")
    expect(parsed.repetitions).toBe(1)
    expect(parsed.scenarioIds).toEqual([])
    expect(parsed.outDir).toContain("reports/verification-")
    expect(parsed.outDir).toContain("-by-set/pr-exec")
    expect(parsed.outDir.startsWith("packages/benchmark/")).toBe(false)
  })

  it("parses repeated scenario ids", () => {
    const parsed = parseArgs([
      "--set",
      "pr-exec",
      "--provider",
      "openai",
      "--scenario-id",
      "a",
      "--scenario-id=b",
    ])

    expect(parsed.scenarioIds).toEqual(["a", "b"])
  })

  it("parses inline scalar flags", () => {
    const parsed = parseArgs([
      "--set=pr-exec",
      "--provider=openai",
      "--model=gpt-5.1-codex-mini",
      "--repetitions=2",
      "--out-dir=reports/custom",
    ])

    expect(parsed.set).toBe("pr-exec")
    expect(parsed.provider).toBe("openai")
    expect(parsed.model).toBe("gpt-5.1-codex-mini")
    expect(parsed.repetitions).toBe(2)
    expect(parsed.outDir).toBe("reports/custom")
  })

  it("rejects missing required scalar flag values", () => {
    expect(() => parseArgs(["--set", "pr-exec", "--provider"])).toThrow(
      "Missing value for --provider",
    )
    expect(() =>
      parseArgs(["--set", "pr-exec", "--provider", "--model", "gpt-5.1-codex-mini"]),
    ).toThrow("Missing value for --provider")
    expect(() => parseArgs(["--set", "--provider", "openai"])).toThrow("Missing value for --set")
    expect(() => parseArgs(["--provider", "openai"])).toThrow("Missing value for --set")
    expect(() => parseArgs(["--set", "pr-exec"])).toThrow("Missing value for --provider")
    expect(() =>
      parseArgs(["--set", "pr-exec", "--provider", "openai", "--repetitions", "0"]),
    ).toThrow("Invalid value for --repetitions")
    expect(() => parseArgs(["--set=", "--provider", "openai"])).toThrow("Missing value for --set")
    expect(() => parseArgs(["--set", "pr-exec", "--provider", "openai", "--scenario-id="])).toThrow(
      "Missing value for --scenario-id",
    )
  })

  it("resolves seed policy by set", () => {
    expect(resolveSeedPolicy("ci-diagnostics")).toBe("read_only")
    expect(resolveSeedPolicy("ci-log-analysis")).toBe("read_only")
    expect(resolveSeedPolicy("pr-exec")).toBe("with_seed")
  })

  it("validates suite rows and reports failing scenarios", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-verify-set-"))
    const suiteFile = join(root, "suite.jsonl")
    await writeFile(
      suiteFile,
      [
        JSON.stringify({ scenario_id: "a", success: true, output_valid: true, error: null }),
        JSON.stringify({
          scenario_id: "b",
          success: false,
          output_valid: true,
          error: { message: "failed" },
        }),
      ].join("\n") + "\n",
      "utf8",
    )

    const summary = await validateSuiteRows(suiteFile)
    expect(summary.rowsActual).toBe(2)
    expect(summary.failingScenarioIds).toEqual(["b"])
    expect(summary.checks.success.fail).toBe(1)
  })

  it("uses suite:config and suite:run orchestration and writes tracking", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-verify-set-"))
    const outDir = join(root, "reports", "pr-exec")
    await mkdir(outDir, { recursive: true })

    const commandRunner = vi.fn(async (command: string, args: string[]) => {
      if (command !== "pnpm") {
        throw new Error(`unexpected command: ${command}`)
      }

      const script = args[3]
      if (script === "suite:config") {
        const outPath = findFlagValue(args, "--out")
        if (!outPath) {
          throw new Error("missing --out for suite:config")
        }
        await writeBaseSuiteConfig(outPath)
        return
      }

      if (script === "suite:run") {
        const configPath = findFlagValue(args, "--config")
        if (!configPath) {
          throw new Error("missing --config for suite:run")
        }
        const config = JSON.parse(await readFile(configPath, "utf8")) as SuiteConfig
        const agentPath = outputPathFromModeArgs(config.benchmark.direct.args)
        const ghxPath = outputPathFromModeArgs(config.benchmark.ghx.args)
        await writeFile(
          agentPath,
          `${JSON.stringify({
            scenario_id: "scenario-a",
            success: true,
            output_valid: true,
            error: null,
          })}\n`,
          "utf8",
        )
        await writeFile(
          ghxPath,
          `${JSON.stringify({
            scenario_id: "scenario-a",
            success: true,
            output_valid: true,
            error: null,
          })}\n`,
          "utf8",
        )

        const { summaryJson, summaryMd } = reportSummaryPaths(
          config.reporting.analysis.report.command,
        )
        await writeFile(summaryJson, "{}\n", "utf8")
        await writeFile(summaryMd, "# Summary\n", "utf8")
      }
    })

    await runVerifySet(
      parseArgs([
        "--set",
        "pr-exec",
        "--provider",
        "openai",
        "--model",
        "gpt-5.1-codex-mini",
        "--out-dir",
        outDir,
      ]),
      {
        runCommand: commandRunner,
        resolveScenarioIdsForSet: async () => ["scenario-a"],
      },
    )

    const commands = commandRunner.mock.calls.map((call) => call[1][3])
    expect(commands).toContain("suite:config")
    expect(commands).toContain("suite:run")
    expect(commands).not.toContain("benchmark")
    expect(commands).not.toContain("report")

    const statusCall = commandRunner.mock.calls.find((call) => call[1][3] === "fixtures")
    expect(statusCall?.[1]).toContain("status")
    const manifestPath = findFlagValue(statusCall?.[1] ?? [], "--out")
    expect(manifestPath).toContain("_run")

    const seedCall = commandRunner.mock.calls.find(
      (call) => call[1][3] === "fixtures" && call[1].includes("seed"),
    )
    const seedManifestPath = findFlagValue(seedCall?.[1] ?? [], "--out")
    expect(seedManifestPath).toBe(manifestPath)

    const trackingPath = join(outDir, "tracking.json")
    const tracking = JSON.parse(await readFile(trackingPath, "utf8"))
    expect(tracking.final_status).toBe("pass")
  })

  it("patches full-set suite config with explicit report and output paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-verify-set-config-"))
    const outDir = join(root, "reports", "pr-exec")
    await mkdir(outDir, { recursive: true })

    let capturedConfigPath: string | null = null
    const commandRunner = vi.fn(async (command: string, args: string[]) => {
      if (command !== "pnpm") {
        throw new Error(`unexpected command: ${command}`)
      }

      const script = args[3]
      if (script === "suite:config") {
        const outPath = findFlagValue(args, "--out")
        if (!outPath) {
          throw new Error("missing --out for suite:config")
        }
        await writeBaseSuiteConfig(outPath)
        return
      }

      if (script === "suite:run") {
        const configPath = findFlagValue(args, "--config")
        if (!configPath) {
          throw new Error("missing --config for suite:run")
        }
        capturedConfigPath = configPath
        const suiteConfig = JSON.parse(await readFile(configPath, "utf8")) as SuiteConfig

        const agentPath = outputPathFromModeArgs(suiteConfig.benchmark.direct.args)
        const ghxPath = outputPathFromModeArgs(suiteConfig.benchmark.ghx.args)
        await writeFile(
          agentPath,
          `${JSON.stringify({
            scenario_id: "scenario-a",
            success: true,
            output_valid: true,
            error: null,
          })}\n`,
          "utf8",
        )
        await writeFile(
          ghxPath,
          `${JSON.stringify({
            scenario_id: "scenario-a",
            success: true,
            output_valid: true,
            error: null,
          })}\n`,
          "utf8",
        )
        const { summaryJson, summaryMd } = reportSummaryPaths(
          suiteConfig.reporting.analysis.report.command,
        )
        await writeFile(summaryJson, "{}\n", "utf8")
        await writeFile(summaryMd, "# Summary\n", "utf8")
      }
    })

    await runVerifySet(
      parseArgs(["--set", "pr-exec", "--provider", "openai", "--out-dir", outDir]),
      {
        runCommand: commandRunner,
        resolveScenarioIdsForSet: async () => ["scenario-a"],
      },
    )

    expect(capturedConfigPath).not.toBeNull()
    if (!capturedConfigPath) {
      throw new Error("expected captured config")
    }
    const config = JSON.parse(await readFile(capturedConfigPath, "utf8")) as SuiteConfig
    expect(config.benchmark.base.scenarioSet).toBe("pr-exec")
    expect(config.benchmark.base.env?.BENCH_FIXTURE_MANIFEST).toContain("_run")
    expect(config.benchmark.direct.args).toContain("--provider")
    expect(config.benchmark.direct.args).toContain("openai")
    expect(config.benchmark.direct.args).toContain("--output-jsonl")
    expect(config.benchmark.ghx.args).toContain("--output-jsonl")
    expect(config.benchmark.direct.args).not.toContain("--scenario")
    expect(config.benchmark.ghx.args).not.toContain("--scenario")
    expect(config.reporting.analysis.report.command).toContain("--suite-jsonl")
    expect(config.reporting.analysis.report.command).toContain("--summary-json")
    expect(config.reporting.analysis.report.command).toContain("--summary-md")
    expect(config.reporting.analysis.report.command).toContain("--gate")
    expect(config.reporting.analysis.gate).toBeUndefined()
  })

  it("retries failed scenarios only and removes scenarioSet on retry config", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-verify-set-rerun-"))
    const outDir = join(root, "reports", "pr-exec")
    await mkdir(outDir, { recursive: true })

    const capturedConfigs: SuiteConfig[] = []
    const commandRunner = vi.fn(async (command: string, args: string[]) => {
      if (command !== "pnpm") {
        throw new Error(`unexpected command: ${command}`)
      }

      const script = args[3]
      if (script === "suite:config") {
        const outPath = findFlagValue(args, "--out")
        if (!outPath) {
          throw new Error("missing --out for suite:config")
        }
        await writeBaseSuiteConfig(outPath)
        return
      }

      if (script === "suite:run") {
        const configPath = findFlagValue(args, "--config")
        if (!configPath) {
          throw new Error("missing --config for suite:run")
        }
        const config = JSON.parse(await readFile(configPath, "utf8")) as SuiteConfig
        capturedConfigs.push(config)
        const attempt = capturedConfigs.length

        const success = attempt > 1
        const agentPath = outputPathFromModeArgs(config.benchmark.direct.args)
        const ghxPath = outputPathFromModeArgs(config.benchmark.ghx.args)
        const row = JSON.stringify({
          scenario_id: "scenario-a",
          success,
          output_valid: success,
          error: success ? null : { message: "failed" },
        })
        await writeFile(agentPath, `${row}\n`, "utf8")
        await writeFile(ghxPath, `${row.replace("scenario-a", "scenario-a")}\n`, "utf8")

        const { summaryJson, summaryMd } = reportSummaryPaths(
          config.reporting.analysis.report.command,
        )
        await writeFile(summaryJson, "{}\n", "utf8")
        await writeFile(summaryMd, "# Summary\n", "utf8")
      }
    })

    await expect(
      runVerifySet(parseArgs(["--set", "pr-exec", "--provider", "openai", "--out-dir", outDir]), {
        runCommand: commandRunner,
        resolveScenarioIdsForSet: async () => ["scenario-a"],
      }),
    ).resolves.toBeUndefined()

    expect(capturedConfigs).toHaveLength(2)
    const initial = capturedConfigs[0] as SuiteConfig
    const retry = capturedConfigs[1] as SuiteConfig
    expect(initial.benchmark.base.scenarioSet).toBe("pr-exec")
    expect(retry.benchmark.base.scenarioSet).toBeUndefined()
    expect(retry.benchmark.direct.args).toContain("--scenario")
    expect(retry.benchmark.direct.args).toContain("scenario-a")
    expect(retry.benchmark.ghx.args).toContain("--scenario")
    expect(retry.benchmark.ghx.args).toContain("scenario-a")

    const trackingPath = join(outDir, "tracking.json")
    const tracking = JSON.parse(await readFile(trackingPath, "utf8"))
    expect(tracking.final_status).toBe("pass")
    expect(tracking.reruns).toHaveLength(1)
    expect(tracking.reruns[0].scenario_ids).toEqual(["scenario-a"])
  })

  it("preserves full-set final rows when only failed scenarios are rerun", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-verify-set-rerun-preserve-"))
    const outDir = join(root, "reports", "pr-exec")
    await mkdir(outDir, { recursive: true })

    const capturedConfigs: SuiteConfig[] = []
    const commandRunner = vi.fn(async (command: string, args: string[]) => {
      if (command !== "pnpm") {
        throw new Error(`unexpected command: ${command}`)
      }

      const script = args[3]
      if (script === "suite:config") {
        const outPath = findFlagValue(args, "--out")
        if (!outPath) {
          throw new Error("missing --out for suite:config")
        }
        await writeBaseSuiteConfig(outPath)
        return
      }

      if (script === "suite:run") {
        const configPath = findFlagValue(args, "--config")
        if (!configPath) {
          throw new Error("missing --config for suite:run")
        }
        const config = JSON.parse(await readFile(configPath, "utf8")) as SuiteConfig
        capturedConfigs.push(config)

        const agentPath = outputPathFromModeArgs(config.benchmark.direct.args)
        const ghxPath = outputPathFromModeArgs(config.benchmark.ghx.args)
        const attempt = capturedConfigs.length

        if (attempt === 1) {
          await writeFile(
            agentPath,
            [
              JSON.stringify({
                scenario_id: "scenario-a",
                iteration: 1,
                success: true,
                output_valid: true,
                error: null,
              }),
              JSON.stringify({
                scenario_id: "scenario-b",
                iteration: 1,
                success: false,
                output_valid: false,
                error: { message: "failed" },
              }),
            ].join("\n") + "\n",
            "utf8",
          )
          await writeFile(
            ghxPath,
            [
              JSON.stringify({
                scenario_id: "scenario-a",
                iteration: 1,
                success: true,
                output_valid: true,
                error: null,
              }),
              JSON.stringify({
                scenario_id: "scenario-b",
                iteration: 1,
                success: false,
                output_valid: false,
                error: { message: "failed" },
              }),
            ].join("\n") + "\n",
            "utf8",
          )
        } else {
          const retryScenario = findFlagValue(config.benchmark.direct.args ?? [], "--scenario")
          if (retryScenario !== "scenario-b") {
            throw new Error(`expected retry scenario-b but received ${retryScenario ?? "<null>"}`)
          }

          const row = JSON.stringify({
            scenario_id: "scenario-b",
            iteration: 1,
            success: true,
            output_valid: true,
            error: null,
          })
          await writeFile(agentPath, `${row}\n`, "utf8")
          await writeFile(ghxPath, `${row}\n`, "utf8")
        }

        const { summaryJson, summaryMd } = reportSummaryPaths(
          config.reporting.analysis.report.command,
        )
        await writeFile(summaryJson, "{}\n", "utf8")
        await writeFile(summaryMd, "# Summary\n", "utf8")
      }
    })

    await expect(
      runVerifySet(parseArgs(["--set", "pr-exec", "--provider", "openai", "--out-dir", outDir]), {
        runCommand: commandRunner,
        resolveScenarioIdsForSet: async () => ["scenario-a", "scenario-b"],
      }),
    ).resolves.toBeUndefined()

    const trackingPath = join(outDir, "tracking.json")
    const tracking = JSON.parse(await readFile(trackingPath, "utf8"))

    expect(tracking.rows_expected.agent_direct).toBe(2)
    expect(tracking.rows_expected.ghx).toBe(2)
    expect(tracking.rows_actual.agent_direct).toBe(2)
    expect(tracking.rows_actual.ghx).toBe(2)
    expect(tracking.final_status).toBe("pass")

    const agentSuiteRows = (await readFile(join(outDir, "agent_direct-suite.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { scenario_id: string })
      .map((row) => row.scenario_id)
      .sort()
    const ghxSuiteRows = (await readFile(join(outDir, "ghx-suite.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { scenario_id: string })
      .map((row) => row.scenario_id)
      .sort()

    expect(agentSuiteRows).toEqual(["scenario-a", "scenario-b"])
    expect(ghxSuiteRows).toEqual(["scenario-a", "scenario-b"])
  })

  it("fails when final row counts do not match expected scenario count", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-verify-set-row-count-"))
    const outDir = join(root, "reports", "pr-exec")
    await mkdir(outDir, { recursive: true })

    const commandRunner = vi.fn(async (command: string, args: string[]) => {
      if (command !== "pnpm") {
        throw new Error(`unexpected command: ${command}`)
      }

      const script = args[3]
      if (script === "suite:config") {
        const outPath = findFlagValue(args, "--out")
        if (!outPath) {
          throw new Error("missing --out for suite:config")
        }
        await writeBaseSuiteConfig(outPath)
        return
      }

      if (script === "suite:run") {
        const configPath = findFlagValue(args, "--config")
        if (!configPath) {
          throw new Error("missing --config for suite:run")
        }
        const config = JSON.parse(await readFile(configPath, "utf8")) as SuiteConfig
        const agentPath = outputPathFromModeArgs(config.benchmark.direct.args)
        const ghxPath = outputPathFromModeArgs(config.benchmark.ghx.args)

        await writeFile(agentPath, "", "utf8")
        await writeFile(ghxPath, "", "utf8")

        const { summaryJson, summaryMd } = reportSummaryPaths(
          config.reporting.analysis.report.command,
        )
        await writeFile(summaryJson, "{}\n", "utf8")
        await writeFile(summaryMd, "# Summary\n", "utf8")
      }
    })

    await expect(
      runVerifySet(parseArgs(["--set", "pr-exec", "--provider", "openai", "--out-dir", outDir]), {
        runCommand: commandRunner,
        resolveScenarioIdsForSet: async () => ["scenario-a"],
      }),
    ).rejects.toThrow("row-count-mismatch")

    const tracking = JSON.parse(await readFile(join(outDir, "tracking.json"), "utf8"))
    expect(tracking.final_status).toBe("terminal_fail")
    expect(tracking.failing_scenarios.join(",")).toContain("row-count-mismatch")
  })

  it("preserves repeated iterations for the same scenario across reruns", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-verify-set-repetitions-"))
    const outDir = join(root, "reports", "pr-exec")
    await mkdir(outDir, { recursive: true })

    let attempt = 0
    const commandRunner = vi.fn(async (command: string, args: string[]) => {
      if (command !== "pnpm") {
        throw new Error(`unexpected command: ${command}`)
      }

      const script = args[3]
      if (script === "suite:config") {
        const outPath = findFlagValue(args, "--out")
        if (!outPath) {
          throw new Error("missing --out for suite:config")
        }
        await writeBaseSuiteConfig(outPath)
        return
      }

      if (script === "suite:run") {
        attempt += 1
        const configPath = findFlagValue(args, "--config")
        if (!configPath) {
          throw new Error("missing --config for suite:run")
        }
        const config = JSON.parse(await readFile(configPath, "utf8")) as SuiteConfig
        const agentPath = outputPathFromModeArgs(config.benchmark.direct.args)
        const ghxPath = outputPathFromModeArgs(config.benchmark.ghx.args)

        if (attempt === 1) {
          const rows = [
            {
              scenario_id: "scenario-a",
              iteration: 1,
              success: true,
              output_valid: true,
              error: null,
            },
            {
              scenario_id: "scenario-a",
              iteration: 2,
              success: false,
              output_valid: false,
              error: { message: "failed" },
            },
          ]
          await writeFile(
            agentPath,
            rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
            "utf8",
          )
          await writeFile(ghxPath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8")
        } else {
          const retryRow = {
            scenario_id: "scenario-a",
            iteration: 2,
            success: true,
            output_valid: true,
            error: null,
          }
          await writeFile(agentPath, `${JSON.stringify(retryRow)}\n`, "utf8")
          await writeFile(ghxPath, `${JSON.stringify(retryRow)}\n`, "utf8")
        }

        const { summaryJson, summaryMd } = reportSummaryPaths(
          config.reporting.analysis.report.command,
        )
        await writeFile(summaryJson, "{}\n", "utf8")
        await writeFile(summaryMd, "# Summary\n", "utf8")
      }
    })

    await expect(
      runVerifySet(
        parseArgs([
          "--set",
          "pr-exec",
          "--provider",
          "openai",
          "--repetitions",
          "2",
          "--out-dir",
          outDir,
        ]),
        {
          runCommand: commandRunner,
          resolveScenarioIdsForSet: async () => ["scenario-a"],
        },
      ),
    ).resolves.toBeUndefined()

    const tracking = JSON.parse(await readFile(join(outDir, "tracking.json"), "utf8"))
    expect(tracking.rows_expected.agent_direct).toBe(2)
    expect(tracking.rows_actual.agent_direct).toBe(2)
    expect(tracking.rows_actual.ghx).toBe(2)
    expect(tracking.final_status).toBe("pass")
  })
})
