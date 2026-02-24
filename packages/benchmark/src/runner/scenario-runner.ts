import { mkdir } from "node:fs/promises"
import type { BenchmarkMode, BenchmarkRow, FixtureManifest, Scenario } from "@bench/domain/types.js"
import { resolveWorkflowFixtureBindings } from "../fixture/manifest.js"
import type { SessionProvider } from "../provider/types.js"
import { evaluateCheckpoints } from "./checkpoint.js"
import type { IterLogContext } from "./iter-log-context.js"
import { modeInstructions } from "./mode-instructions.js"
import { withRetry } from "./retry.js"
import { exportSession } from "./session-export.js"

export async function runScenarioIteration(config: {
  provider: SessionProvider
  scenario: Scenario
  mode: BenchmarkMode
  iteration: number
  scenarioSet: string | null
  manifest: FixtureManifest | null
  runId: string
  githubToken: string
  iterLogContext?: IterLogContext | null
}): Promise<BenchmarkRow> {
  const {
    provider,
    scenario,
    mode,
    iteration,
    scenarioSet,
    manifest,
    runId,
    githubToken,
    iterLogContext = null,
  } = config

  if (iterLogContext !== null) {
    await mkdir(iterLogContext.iterDir, { recursive: true })
  }

  const scenarioStartedAt = Date.now()
  const agentStartedAt = Date.now()
  let sessionId: string | null = null

  try {
    let resolvedScenario = scenario

    if (manifest) {
      resolvedScenario = resolveWorkflowFixtureBindings(scenario, manifest)
    }

    const systemInstructions = await modeInstructions(mode, async () => {
      const ghxInstructionPath = process.env.GHX_SKILL_PATH
      if (ghxInstructionPath) {
        const { readFile } = await import("node:fs/promises")
        return readFile(ghxInstructionPath, "utf8")
      }
      return "Use the ghx tool to complete the task."
    })

    const sessionHandle = await provider.createSession({
      mode,
      systemInstructions,
    })
    sessionId = sessionHandle.sessionId

    const promptText = resolvedScenario.prompt
    const maxAttempts = (scenario.allowed_retries ?? 0) + 1
    const { result: promptResult, attempts } = await withRetry(
      () => provider.prompt(sessionHandle, promptText, scenario.timeout_ms),
      { maxAttempts, backoffMs: 2000 },
    )
    const latencyMsAgent = Date.now() - agentStartedAt

    const { allPassed: checkpointsPassed, results: checkpointResults } = await evaluateCheckpoints(
      resolvedScenario.assertions.checkpoints,
      githubToken,
    )

    const expectedOutcome = resolvedScenario.assertions.expected_outcome
    const success = expectedOutcome === "success" ? checkpointsPassed : !checkpointsPassed

    const errorReason = !success
      ? `Workflow checkpoint verification failed: ${
          checkpointResults
            .filter((c) => !c.passed)
            .map((c) => c.name)
            .join(", ") || "outcome mismatch"
        }`
      : null

    return {
      timestamp: new Date().toISOString(),
      run_id: runId,
      mode,
      scenario_id: scenario.id,
      scenario_set: scenarioSet,
      iteration,
      session_id: sessionId,
      success,
      output_valid: checkpointsPassed,
      latency_ms_wall: Date.now() - scenarioStartedAt,
      latency_ms_agent: latencyMsAgent,
      sdk_latency_ms: promptResult.sdkLatencyMs,
      tokens: {
        input: promptResult.tokens.input,
        output: promptResult.tokens.output,
        reasoning: promptResult.tokens.reasoning,
        cache_read: promptResult.tokens.cacheRead,
        cache_write: promptResult.tokens.cacheWrite,
        total: promptResult.tokens.total,
      },
      cost: promptResult.cost,
      tool_calls: promptResult.toolCalls,
      api_calls: promptResult.apiCalls,
      internal_retry_count: 0,
      external_retry_count: attempts - 1,
      model: {
        provider_id: promptResult.model.providerId,
        model_id: promptResult.model.modelId,
        mode: null,
      },
      git: {
        repo: null,
        commit: null,
      },
      error: errorReason ? { type: "checkpoint_failed", message: errorReason } : null,
      ...(promptResult.timingBreakdown ? { timing_breakdown: promptResult.timingBreakdown } : {}),
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)

    return {
      timestamp: new Date().toISOString(),
      run_id: runId,
      mode,
      scenario_id: scenario.id,
      scenario_set: scenarioSet,
      iteration,
      session_id: sessionId,
      success: false,
      output_valid: false,
      latency_ms_wall: Date.now() - scenarioStartedAt,
      latency_ms_agent: Date.now() - agentStartedAt,
      sdk_latency_ms: null,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache_read: 0,
        cache_write: 0,
        total: 0,
      },
      cost: 0,
      tool_calls: 0,
      api_calls: 0,
      internal_retry_count: 0,
      external_retry_count: 0,
      model: {
        provider_id: "",
        model_id: "",
        mode: null,
      },
      git: {
        repo: null,
        commit: null,
      },
      error: {
        type: "runner_error",
        message,
      },
    }
  } finally {
    if (iterLogContext !== null && sessionId !== null) {
      try {
        const exportResult = await exportSession({ sessionId, destDir: iterLogContext.iterDir })
        if (!exportResult.ok) {
          console.warn(`[benchmark] session export failed for ${sessionId}: ${exportResult.reason}`)
        }
      } catch (exportError) {
        const msg = exportError instanceof Error ? exportError.message : String(exportError)
        console.warn(`[benchmark] session export threw for ${sessionId}: ${msg}`)
      }
    }
  }
}
