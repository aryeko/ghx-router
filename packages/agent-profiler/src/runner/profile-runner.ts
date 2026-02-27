import type { Analyzer } from "../contracts/analyzer.js"
import type { Collector } from "../contracts/collector.js"
import type { RunHooks } from "../contracts/hooks.js"
import type { ModeResolver } from "../contracts/mode-resolver.js"
import type { SessionProvider } from "../contracts/provider.js"
import type { Scorer } from "../contracts/scorer.js"
import { createLogger } from "../shared/logger.js"
import { appendJsonlLine } from "../store/jsonl-store.js"
import type { ProfileRow } from "../types/profile-row.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionAnalysisBundle } from "../types/trace.js"
import { runIteration } from "./iteration.js"
import { runWarmup } from "./warmup.js"

export interface ProfileSuiteOptions {
  readonly modes: readonly string[]
  readonly scenarios: readonly BaseScenario[]
  readonly repetitions: number
  readonly provider: SessionProvider
  readonly scorer: Scorer
  readonly modeResolver: ModeResolver
  readonly collectors: readonly Collector[]
  readonly analyzers: readonly Analyzer[]
  readonly hooks: RunHooks
  readonly warmup: boolean
  readonly sessionExport: boolean
  readonly outputJsonlPath: string
  readonly logLevel: "debug" | "info" | "warn" | "error"
}

export interface ProfileSuiteResult {
  readonly runId: string
  readonly rows: readonly ProfileRow[]
  readonly durationMs: number
  readonly outputJsonlPath: string
  readonly analysisResults: readonly SessionAnalysisBundle[]
}

export async function runProfileSuite(options: ProfileSuiteOptions): Promise<ProfileSuiteResult> {
  const {
    modes,
    scenarios,
    repetitions,
    provider,
    scorer,
    modeResolver,
    collectors,
    analyzers,
    hooks,
    warmup,
    sessionExport,
    outputJsonlPath,
    logLevel,
  } = options

  const runId = `run_${Date.now()}`
  const logger = createLogger(logLevel)
  const suiteStart = Date.now()
  const rows: ProfileRow[] = []
  const allAnalysisBundles: SessionAnalysisBundle[] = []

  if (hooks.beforeRun) {
    await hooks.beforeRun({ runId, modes, scenarios, repetitions })
  }

  await provider.init({
    port: 0,
    model: "",
    mode: "",
    permissions: { autoApprove: true, allowedTools: [] },
    environment: {},
    workdir: "",
  })

  if (warmup && scenarios.length > 0 && modes.length > 0) {
    const firstMode = modes[0]
    const firstScenario = scenarios[0]
    if (firstMode && firstScenario) {
      const modeConfig = await modeResolver.resolve(firstMode)
      await runWarmup(provider, firstScenario, modeConfig.systemInstructions, logger)
    }
  }

  for (const mode of modes) {
    const modeConfig = await modeResolver.resolve(mode)

    if (hooks.beforeMode) {
      await hooks.beforeMode(mode)
    }

    for (const scenario of scenarios) {
      for (let rep = 0; rep < repetitions; rep++) {
        logger.info(`[${mode}] ${scenario.id} iteration ${rep + 1}/${repetitions}`)

        const { row, analysisResults } = await runIteration({
          provider,
          scorer,
          collectors,
          analyzers,
          hooks,
          scenario,
          mode,
          model: (modeConfig.providerOverrides["model"] as string) ?? "",
          iteration: rep,
          runId,
          systemInstructions: modeConfig.systemInstructions,
          sessionExport,
          logger,
        })

        if (analysisResults.length > 0) {
          allAnalysisBundles.push({
            sessionId: row.sessionId,
            scenarioId: scenario.id,
            mode,
            model: row.model,
            results: Object.fromEntries(analysisResults.map((r) => [r.analyzer, r])),
          })
        }

        await appendJsonlLine(outputJsonlPath, row)
        rows.push(row)
      }
    }

    if (hooks.afterMode) {
      await hooks.afterMode(mode)
    }
  }

  if (hooks.afterRun) {
    await hooks.afterRun({ runId, modes, scenarios, repetitions })
  }

  await provider.shutdown()

  const durationMs = Date.now() - suiteStart
  return { runId, rows, durationMs, outputJsonlPath, analysisResults: allAnalysisBundles }
}
