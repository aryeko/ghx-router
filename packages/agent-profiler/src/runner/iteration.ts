import type { Analyzer } from "../contracts/analyzer.js"
import type { Collector } from "../contracts/collector.js"
import type { RunHooks } from "../contracts/hooks.js"
import type { PromptResult, SessionProvider } from "../contracts/provider.js"
import type { Scorer, ScorerResult } from "../contracts/scorer.js"
import type { Logger } from "../shared/logger.js"
import type { CustomMetric, ToolCallRecord } from "../types/metrics.js"
import type { CheckpointResult, ProfileRow } from "../types/profile-row.js"
import type { BaseScenario } from "../types/scenario.js"
import type { AnalysisResult, SessionTrace } from "../types/trace.js"

/** Parameters required to execute a single scenario iteration. */
export interface IterationParams {
  /** Provider implementation that manages the agent session. */
  readonly provider: SessionProvider
  /** Scorer that evaluates the agent output against scenario criteria. */
  readonly scorer: Scorer
  /** Collectors that extract additional metrics after the prompt completes. */
  readonly collectors: readonly Collector[]
  /** Analyzers that produce structured findings from the session trace. */
  readonly analyzers: readonly Analyzer[]
  /** Lifecycle hooks called before and after this iteration. */
  readonly hooks: RunHooks
  /** The scenario to execute. */
  readonly scenario: BaseScenario
  /** Execution mode name for this iteration. */
  readonly mode: string
  /** Model identifier for this iteration. */
  readonly model: string
  /** Zero-based repetition index. */
  readonly iteration: number
  /** Identifier of the parent profiling run. */
  readonly runId: string
  /** System instructions injected at session creation. */
  readonly systemInstructions: string
  /** When true, the full session trace is exported after the prompt. */
  readonly sessionExport: boolean
  /** Maximum number of retry attempts on prompt failure. */
  readonly allowedRetries: number
  /** Logger instance for this iteration. */
  readonly logger: Logger
}

function buildToolCallStats(records: readonly ToolCallRecord[]): ProfileRow["toolCalls"] {
  const total = records.length
  const failed = records.filter((r) => !r.success).length
  const byCategory: Record<string, number> = {}
  for (const record of records) {
    byCategory[record.category] = (byCategory[record.category] ?? 0) + 1
  }
  return {
    total,
    byCategory,
    failed,
    retried: 0,
    errorRate: total > 0 ? failed / total : 0,
    records,
  }
}

function mapCheckpoints(details: ScorerResult["details"]): readonly CheckpointResult[] {
  return details.map((d) => ({
    id: d.id,
    description: d.description,
    passed: d.passed,
    ...(d.actual !== undefined ? { actual: d.actual } : {}),
    ...(d.expected !== undefined ? { expected: d.expected } : {}),
  }))
}

function buildExtensions(metrics: readonly CustomMetric[]): Readonly<Record<string, unknown>> {
  const extensions: Record<string, unknown> = {}
  for (const m of metrics) {
    extensions[m.name] = m.value
  }
  return extensions
}

function makeFailedRow(params: IterationParams, startedAt: string, error: string): ProfileRow {
  return {
    runId: params.runId,
    scenarioId: params.scenario.id,
    mode: params.mode,
    model: params.model,
    iteration: params.iteration,
    startedAt,
    completedAt: new Date().toISOString(),
    tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: 0, active: 0 },
    timing: { wallMs: 0, segments: [] },
    toolCalls: { total: 0, byCategory: {}, failed: 0, retried: 0, errorRate: 0, records: [] },
    cost: { totalUsd: 0, inputUsd: 0, outputUsd: 0, reasoningUsd: 0 },
    success: false,
    checkpointsPassed: 0,
    checkpointsTotal: 0,
    checkpointDetails: [],
    outputValid: false,
    provider: params.provider.id,
    sessionId: "",
    agentTurns: 0,
    completionReason: "error",
    extensions: {},
    error,
  }
}

/**
 * Execute a single scenario iteration, including session creation, prompting,
 * metric collection, trace analysis, and scoring.
 *
 * Retries the prompt up to `params.allowedRetries` times on failure before
 * returning a failed ProfileRow. Lifecycle hooks are called regardless of
 * success or failure.
 *
 * @param params - All configuration needed to run this iteration.
 * @returns The profile row, session trace (or null), and any analysis results.
 */
export async function runIteration(params: IterationParams): Promise<{
  readonly row: ProfileRow
  readonly trace: SessionTrace | null
  readonly analysisResults: readonly AnalysisResult[]
}> {
  const {
    provider,
    scorer,
    collectors,
    analyzers,
    hooks,
    scenario,
    mode,
    model,
    iteration,
    runId,
    systemInstructions,
    sessionExport,
    allowedRetries,
    logger,
  } = params

  const startedAt = new Date().toISOString()

  if (hooks.beforeScenario) {
    await hooks.beforeScenario({ scenario, mode, model, iteration })
  }

  let handle = null as Awaited<ReturnType<SessionProvider["createSession"]>> | null
  try {
    let promptResult: PromptResult | null = null
    let lastError = ""

    for (let attempt = 0; attempt <= allowedRetries; attempt++) {
      try {
        handle = await provider.createSession({
          systemInstructions,
          scenarioId: scenario.id,
          iteration,
        })
        promptResult = await provider.prompt(handle, scenario.prompt, scenario.timeoutMs)
        break
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        if (handle) {
          await provider.destroySession(handle).catch((destroyErr: unknown) => {
            logger.warn(
              `Failed to destroy session during retry cleanup: ${destroyErr instanceof Error ? destroyErr.message : String(destroyErr)}`,
            )
          })
          handle = null
        }
        if (attempt < allowedRetries) {
          logger.warn(
            `Iteration ${iteration} attempt ${attempt + 1} failed, retrying: ${lastError}`,
          )
        }
      }
    }

    if (!promptResult || !handle) {
      throw new Error(lastError || "All retry attempts failed with unknown error")
    }

    const result: PromptResult = promptResult
    const activeHandle = handle

    const needsTrace = sessionExport || analyzers.length > 0
    let trace: SessionTrace | null = null
    if (needsTrace) {
      trace = await provider.exportSession(activeHandle)
    }

    const allMetrics: CustomMetric[] = []
    for (const collector of collectors) {
      const metrics = await collector.collect(result, scenario, mode, trace)
      allMetrics.push(...metrics)
    }

    const iterationAnalysisResults: AnalysisResult[] = []
    if (trace) {
      for (const analyzer of analyzers) {
        const analysisResult = await analyzer.analyze(trace, scenario, mode)
        iterationAnalysisResults.push(analysisResult)
      }
    }

    const scorerResult: ScorerResult = await scorer.evaluate(scenario, {
      agentOutput: result.text,
      trace,
      mode,
      model,
      iteration,
      metadata: {},
    })

    const agentTurns = trace ? trace.summary.totalTurns : 1

    const row: ProfileRow = {
      runId,
      scenarioId: scenario.id,
      mode,
      model,
      iteration,
      startedAt,
      completedAt: new Date().toISOString(),
      tokens: result.metrics.tokens,
      timing: result.metrics.timing,
      toolCalls: buildToolCallStats(result.metrics.toolCalls),
      cost: result.metrics.cost,
      success: scorerResult.success,
      checkpointsPassed: scorerResult.passed,
      checkpointsTotal: scorerResult.total,
      checkpointDetails: mapCheckpoints(scorerResult.details),
      outputValid: scorerResult.outputValid,
      provider: provider.id,
      sessionId: activeHandle.sessionId,
      agentTurns,
      completionReason: result.completionReason,
      extensions: buildExtensions(allMetrics),
    }

    if (hooks.afterScenario) {
      await hooks.afterScenario({ scenario, mode, model, iteration, result: row, trace })
    }

    return { row, trace, analysisResults: iterationAnalysisResults }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`Iteration ${iteration} failed: ${message}`)
    const failedRow = makeFailedRow(params, startedAt, message)

    if (hooks.afterScenario) {
      await hooks.afterScenario({
        scenario,
        mode,
        model,
        iteration,
        result: failedRow,
        trace: null,
      })
    }

    return { row: failedRow, trace: null, analysisResults: [] }
  } finally {
    if (handle) {
      try {
        await provider.destroySession(handle)
      } catch (destroyErr) {
        logger.warn(
          `Failed to destroy session ${handle.sessionId}: ${destroyErr instanceof Error ? destroyErr.message : String(destroyErr)}`,
        )
      }
    }
  }
}
