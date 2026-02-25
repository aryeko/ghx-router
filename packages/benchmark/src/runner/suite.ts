import { randomUUID } from "node:crypto"
import { appendFile, mkdir, readdir, rename } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { BenchmarkMode, FixtureManifest, Scenario } from "../domain/types.js"
import { resetScenarioFixtures } from "../fixture/reset.js"
import { createSessionProvider } from "../provider/factory.js"
import { buildIterDir } from "./iter-log-context.js"
import { runScenarioIteration } from "./scenario-runner.js"

export type ProgressEvent =
  | {
      type: "suite_started"
      mode: BenchmarkMode
      scenarioCount: number
      repetitions: number
      total: number
      completed: number
    }
  | {
      type: "scenario_started"
      scenarioId: string
      iteration: number
      total: number
      completed: number
    }
  | {
      type: "scenario_finished"
      scenarioId: string
      iteration: number
      success: boolean
      total: number
      completed: number
    }
  | {
      type: "suite_finished"
      mode: BenchmarkMode
      total: number
      completed: number
      successful: number
    }
  | { type: "suite_error"; mode: BenchmarkMode; message: string }

export async function runSuite(config: {
  modes: BenchmarkMode[]
  scenarios: Scenario[]
  repetitions: number
  manifest: FixtureManifest | null
  outputJsonlPath: string
  onProgress: (event: ProgressEvent) => void
  providerConfig: { type: "opencode"; providerId: string; modelId: string }
  skipWarmup?: boolean
  scenarioSet?: string | null
  reviewerToken?: string | null
  benchRunTs?: string | null
  benchLogsDir?: string | null
}): Promise<{ rowCount: number; durationMs: number }> {
  const {
    modes,
    scenarios,
    repetitions,
    manifest: initialManifest,
    outputJsonlPath,
    onProgress,
    providerConfig,
    skipWarmup = false,
    scenarioSet = null,
    reviewerToken = null,
    benchRunTs = null,
    benchLogsDir = null,
  } = config
  let manifest = initialManifest
  const githubToken = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? ""

  const suiteStartedAt = Date.now()
  const suiteRunId = randomUUID()

  const totalScenarioExecutions = scenarios.length * repetitions * modes.length

  try {
    await mkdir(dirname(outputJsonlPath), { recursive: true })

    const selectedScenarioIds = scenarios.map((scenario) => scenario.id)

    console.log(
      `[benchmark] start: modes=${modes.join(",")} provider=${providerConfig.providerId} model=${providerConfig.modelId}`,
    )
    console.log(
      `[benchmark] config: repetitions=${repetitions} scenario_set=${scenarioSet ?? "<null>"} scenarios=${scenarios.length}`,
    )
    console.log(`[benchmark] scenarios: ${selectedScenarioIds.join(",")}`)
    console.log(`[benchmark] context: out_file=${outputJsonlPath}`)

    if (!skipWarmup && scenarios.length > 0) {
      const warmupScenario = scenarios[0]
      if (warmupScenario) {
        console.log(`[benchmark] warm-up canary: running ${warmupScenario.id}`)
        try {
          if (manifest !== null) {
            manifest = await resetScenarioFixtures(warmupScenario, manifest, reviewerToken)
          }

          const provider = await createSessionProvider({
            type: "opencode",
            providerId: providerConfig.providerId,
            modelId: providerConfig.modelId,
          })

          try {
            const warmupResult = await runScenarioIteration({
              provider,
              scenario: warmupScenario,
              mode: modes[0] ?? "ghx",
              iteration: 0,
              scenarioSet: null,
              manifest,
              runId: suiteRunId,
              githubToken,
            })

            console.log(
              `[benchmark] warm-up canary: ${warmupResult.success ? "success" : "failed"} (${warmupResult.latency_ms_wall}ms)`,
            )
          } finally {
            await provider.cleanup()
          }
        } catch (error) {
          console.log(
            `[benchmark] warm-up canary: error (${error instanceof Error ? error.message : String(error)})`,
          )
        }
      }
    }

    let totalCompleted = 0
    let totalSuccessful = 0

    for (const mode of modes) {
      const modeStartSuccessful = totalSuccessful

      onProgress({
        type: "suite_started",
        mode,
        scenarioCount: scenarios.length,
        repetitions,
        total: totalScenarioExecutions,
        completed: totalCompleted,
      })

      // Set GHX_LOG_DIR to a staging dir before spawning the opencode provider so the ghx
      // subprocess inherits the env var and writes logs there. After each iteration we move
      // newly-created files into the per-iteration dir.
      let ghxStagingDir: string | null = null
      let prevGhxLogDir: string | undefined
      let prevGhxLogLevel: string | undefined

      if (benchLogsDir && benchRunTs) {
        const date = benchRunTs.slice(0, 10)
        ghxStagingDir = join(benchLogsDir, date, benchRunTs, mode, "_ghx")
        await mkdir(ghxStagingDir, { recursive: true })
        prevGhxLogDir = process.env.GHX_LOG_DIR
        prevGhxLogLevel = process.env.GHX_LOG_LEVEL
        process.env.GHX_LOG_DIR = ghxStagingDir
        process.env.GHX_LOG_LEVEL = process.env.BENCH_GHX_LOG_LEVEL ?? "info"
      }

      let provider: Awaited<ReturnType<typeof createSessionProvider>> | null = null

      try {
        provider = await createSessionProvider({
          type: "opencode",
          providerId: providerConfig.providerId,
          modelId: providerConfig.modelId,
        })

        for (const scenario of scenarios) {
          for (let iteration = 1; iteration <= repetitions; iteration += 1) {
            onProgress({
              type: "scenario_started",
              scenarioId: scenario.id,
              iteration,
              total: totalScenarioExecutions,
              completed: totalCompleted,
            })

            if (manifest !== null) {
              manifest = await resetScenarioFixtures(scenario, manifest, reviewerToken)
            }

            const iterLogContext =
              benchLogsDir && benchRunTs
                ? {
                    iterDir: buildIterDir({
                      benchLogsDir,
                      benchRunTs,
                      mode,
                      scenarioId: scenario.id,
                      iteration,
                    }),
                  }
                : null

            // Snapshot staging dir before iteration so we can identify new ghx log files
            let ghxFilesBefore: Set<string> | null = null
            if (ghxStagingDir !== null) {
              const files = await readdir(ghxStagingDir).catch(() => [])
              ghxFilesBefore = new Set(files)
            }

            const result = await runScenarioIteration({
              provider,
              scenario,
              mode,
              iteration,
              scenarioSet,
              manifest,
              runId: suiteRunId,
              githubToken,
              iterLogContext,
            })

            // Move ghx log files written during this iteration into the iter dir
            if (ghxStagingDir !== null && ghxFilesBefore !== null && iterLogContext !== null) {
              const filesAfter = await readdir(ghxStagingDir).catch(() => [])
              const before = ghxFilesBefore
              const newFiles = filesAfter.filter((f) => !before.has(f))
              for (const file of newFiles) {
                try {
                  await rename(join(ghxStagingDir, file), join(iterLogContext.iterDir, file))
                } catch (moveError) {
                  console.warn(
                    `[suite] Failed to move ghx log file "${file}" to iter dir: ${moveError instanceof Error ? moveError.message : String(moveError)}`,
                  )
                }
              }
            }

            await appendFile(outputJsonlPath, `${JSON.stringify(result)}\n`, "utf8")

            totalCompleted += 1
            if (result.success) {
              totalSuccessful += 1
            }

            onProgress({
              type: "scenario_finished",
              scenarioId: scenario.id,
              iteration,
              success: result.success,
              total: totalScenarioExecutions,
              completed: totalCompleted,
            })
          }
        }
      } finally {
        await provider?.cleanup()
        if (ghxStagingDir !== null) {
          if (prevGhxLogDir === undefined) {
            delete process.env.GHX_LOG_DIR
          } else {
            process.env.GHX_LOG_DIR = prevGhxLogDir
          }
          if (prevGhxLogLevel === undefined) {
            delete process.env.GHX_LOG_LEVEL
          } else {
            process.env.GHX_LOG_LEVEL = prevGhxLogLevel
          }
        }
      }

      onProgress({
        type: "suite_finished",
        mode,
        total: totalScenarioExecutions,
        completed: totalCompleted,
        successful: totalSuccessful - modeStartSuccessful,
      })
    }

    const durationMs = Date.now() - suiteStartedAt
    console.log(`Wrote benchmark suite results: ${outputJsonlPath}`)

    return { rowCount: totalCompleted, durationMs }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const mode = modes[0] ?? "ghx"
    onProgress({ type: "suite_error", mode, message })
    throw error
  }
}
