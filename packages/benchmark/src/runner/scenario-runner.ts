import { randomUUID } from "node:crypto"
import type { BenchmarkMode, BenchmarkRow, FixtureManifest, Scenario } from "@bench/domain/types.js"
import { resolveWorkflowFixtureBindings } from "../fixture/manifest.js"
import type { SessionProvider } from "../provider/types.js"
import { evaluateCheckpoints } from "./checkpoint.js"
import { modeInstructions } from "./mode-instructions.js"

function renderWorkflowPrompt(scenario: Scenario, _mode: BenchmarkMode): string {
  return scenario.prompt
}

export async function runScenarioIteration(config: {
  provider: SessionProvider
  scenario: Scenario
  mode: BenchmarkMode
  iteration: number
  scenarioSet: string | null
  manifest: FixtureManifest | null
  runId: string
}): Promise<BenchmarkRow> {
  const { provider, scenario, mode, iteration, scenarioSet, manifest } = config

  const githubToken = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? ""

  const scenarioStartedAt = Date.now()
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

    const promptText = renderWorkflowPrompt(resolvedScenario, mode)
    const promptResult = await provider.prompt(sessionHandle, promptText)

    const { allPassed: checkpointsPassed, results: checkpointResults } = await evaluateCheckpoints(
      resolvedScenario.assertions.checkpoints,
      {},
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

    const result: BenchmarkRow = {
      timestamp: new Date().toISOString(),
      run_id: randomUUID(),
      mode,
      scenario_id: scenario.id,
      scenario_set: scenarioSet,
      iteration,
      session_id: sessionId,
      success,
      output_valid: checkpointsPassed,
      latency_ms_wall: Date.now() - scenarioStartedAt,
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
      api_calls: 0,
      internal_retry_count: 0,
      external_retry_count: 0,
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
    }

    if (promptResult.timingBreakdown) {
      result.timing_breakdown = promptResult.timingBreakdown
    }

    return result
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)

    return {
      timestamp: new Date().toISOString(),
      run_id: randomUUID(),
      mode,
      scenario_id: scenario.id,
      scenario_set: scenarioSet,
      iteration,
      session_id: sessionId,
      success: false,
      output_valid: false,
      latency_ms_wall: Date.now() - scenarioStartedAt,
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
  }
}
