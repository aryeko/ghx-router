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

/** Options for configuring and executing a full profiling suite. */
export interface ProfileSuiteOptions {
  /** Ordered list of execution mode names to profile. */
  readonly modes: readonly string[]
  /** Scenarios to execute in each mode. */
  readonly scenarios: readonly BaseScenario[]
  /** Number of times each scenario is repeated per mode. */
  readonly repetitions: number
  /** Maximum number of retry attempts allowed per iteration on failure. */
  readonly allowedRetries: number
  /** Provider implementation that manages agent sessions. */
  readonly provider: SessionProvider
  /** Scorer implementation that evaluates agent output. */
  readonly scorer: Scorer
  /** Resolver that maps mode names to their full configurations. */
  readonly modeResolver: ModeResolver
  /** Collectors that extract additional metrics from each completed iteration. */
  readonly collectors: readonly Collector[]
  /** Analyzers that produce structured findings from session traces. */
  readonly analyzers: readonly Analyzer[]
  /** Lifecycle hooks invoked at suite, mode, and iteration boundaries. */
  readonly hooks: RunHooks
  /** When true, a warmup canary iteration is executed before the main suite. */
  readonly warmup: boolean
  /** When true, the full session trace is exported after each iteration. */
  readonly sessionExport: boolean
  /** Absolute path to the JSONL file where profile rows are appended. */
  readonly outputJsonlPath: string
  /** Minimum severity level for log output during the suite run. */
  readonly logLevel: "debug" | "info" | "warn" | "error"
}

/** Summary result returned after a complete profiling suite has finished. */
export interface ProfileSuiteResult {
  /** Unique identifier assigned to this profiling run. */
  readonly runId: string
  /** All profile rows collected across every mode, scenario, and repetition. */
  readonly rows: readonly ProfileRow[]
  /** Total elapsed wall-clock time for the suite in milliseconds. */
  readonly durationMs: number
  /** Absolute path to the JSONL file where rows were written. */
  readonly outputJsonlPath: string
  /** Analysis bundles produced for sessions where analyzers were configured. */
  readonly analysisResults: readonly SessionAnalysisBundle[]
}

/**
 * Execute a full profiling suite across all configured modes and scenarios.
 *
 * Runs each scenario for every mode the specified number of repetitions, collecting
 * metrics, running analyzers, and writing results to the output JSONL path. A warmup
 * canary iteration is performed first when `options.warmup` is true.
 *
 * @param options - Suite configuration including scenarios, modes, provider, and output paths.
 * @returns A result object containing all profile rows and aggregated analysis bundles.
 */
export async function runProfileSuite(options: ProfileSuiteOptions): Promise<ProfileSuiteResult> {
  const {
    modes,
    scenarios,
    repetitions,
    allowedRetries,
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

  if (repetitions < 1) {
    throw new Error(`repetitions must be >= 1, got ${repetitions}`)
  }
  if (allowedRetries < 0) {
    throw new Error(`allowedRetries must be >= 0, got ${allowedRetries}`)
  }

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

  try {
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
            allowedRetries,
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
  } finally {
    await provider.shutdown()
  }

  const durationMs = Date.now() - suiteStart
  return { runId, rows, durationMs, outputJsonlPath, analysisResults: allAnalysisBundles }
}
