import { randomUUID } from "node:crypto"
import { appendFile, mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import type { BenchmarkMode, FixtureManifest, Scenario } from "../domain/types.js"
import { resolveWorkflowFixtureBindings } from "../fixture/manifest.js"
import { createSessionProvider } from "../provider/factory.js"
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
}): Promise<{ rowCount: number; durationMs: number }> {
  const {
    modes,
    scenarios,
    repetitions,
    manifest,
    outputJsonlPath,
    onProgress,
    providerConfig,
    skipWarmup = false,
    scenarioSet = null,
  } = config

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
          const provider = await createSessionProvider({
            type: "opencode",
            mode: modes[0] ?? "ghx",
            providerId: providerConfig.providerId,
            modelId: providerConfig.modelId,
          })

          const warmupResult = await runScenarioIteration({
            provider,
            scenario: warmupScenario,
            mode: modes[0] ?? "ghx",
            iteration: 0,
            scenarioSet: null,
            manifest,
            runId: suiteRunId,
          })

          await provider.cleanup()

          console.log(
            `[benchmark] warm-up canary: ${warmupResult.success ? "success" : "failed"} (${warmupResult.latency_ms_wall}ms)`,
          )
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
      const modeStartCompleted = totalCompleted

      onProgress({
        type: "suite_started",
        mode,
        scenarioCount: scenarios.length,
        repetitions,
        total: totalScenarioExecutions,
        completed: totalCompleted,
      })

      const provider = await createSessionProvider({
        type: "opencode",
        mode,
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

          let resolvedScenario = scenario
          if (manifest) {
            resolvedScenario = resolveWorkflowFixtureBindings(scenario, manifest)
          }

          const result = await runScenarioIteration({
            provider,
            scenario: resolvedScenario,
            mode,
            iteration,
            scenarioSet,
            manifest,
            runId: suiteRunId,
          })

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

      await provider.cleanup()

      onProgress({
        type: "suite_finished",
        mode,
        total: totalScenarioExecutions,
        completed: totalCompleted,
        successful: totalSuccessful - (totalSuccessful - (totalCompleted - modeStartCompleted)),
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
