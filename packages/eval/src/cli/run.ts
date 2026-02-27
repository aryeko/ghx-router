import { readFile } from "node:fs/promises"
import { GhxCollector } from "@eval/collector/ghx-collector.js"
import { loadEvalConfig } from "@eval/config/loader.js"
import type { EvalConfig } from "@eval/config/schema.js"
import { FixtureManager } from "@eval/fixture/manager.js"
import { createEvalHooks } from "@eval/hooks/eval-hooks.js"
import { EvalModeResolver } from "@eval/mode/resolver.js"
import { OpenCodeProvider } from "@eval/provider/opencode-provider.js"
import { loadEvalScenarios } from "@eval/scenario/loader.js"
import { CheckpointScorer } from "@eval/scorer/checkpoint-scorer.js"
import type { BaseScenario } from "@ghx-dev/agent-profiler"
import { runProfileSuite } from "@ghx-dev/agent-profiler"
import { hasFlag, parseFlag, parseFlagAll } from "./parse-flags.js"

function applyFlagOverrides(config: EvalConfig, argv: readonly string[]): EvalConfig {
  let result: EvalConfig = config

  const models = parseFlagAll(argv, "--model")
  if (models.length > 0) {
    result = {
      ...result,
      models: models.map((id) => ({ id, label: id })),
    }
  }

  const modes = parseFlagAll(argv, "--mode")
  if (modes.length > 0) {
    result = { ...result, modes: [...modes] }
  }

  const scenarioIds = parseFlagAll(argv, "--scenario")
  if (scenarioIds.length > 0) {
    result = {
      ...result,
      scenarios: { ...result.scenarios, ids: [...scenarioIds] },
    }
  }

  const scenarioSet = parseFlag(argv, "--scenario-set")
  if (scenarioSet !== null) {
    result = {
      ...result,
      scenarios: { ...result.scenarios, set: scenarioSet },
    }
  }

  const repStr = parseFlag(argv, "--repetitions")
  if (repStr !== null) {
    const repetitions = Number(repStr)
    if (!Number.isNaN(repetitions) && repetitions > 0) {
      result = { ...result, execution: { ...result.execution, repetitions } }
    } else {
      console.warn(`Warning: invalid --repetitions value "${repStr}", using config default`)
    }
  }

  if (hasFlag(argv, "--skip-warmup")) {
    result = {
      ...result,
      execution: { ...result.execution, warmup: false },
    }
  }

  if (hasFlag(argv, "--seed-if-missing")) {
    result = {
      ...result,
      fixtures: { ...result.fixtures, seed_if_missing: true },
    }
  }

  // --output-jsonl sets the output path for runProfileSuite (overrides config.output.results_dir)
  // The agent-profiler will write results to this path
  const outputJsonl = parseFlag(argv, "--output-jsonl")
  if (outputJsonl !== null) {
    result = {
      ...result,
      output: { ...result.output, results_dir: outputJsonl },
    }
  }

  return result
}

export async function run(argv: readonly string[]): Promise<void> {
  const configPath = parseFlag(argv, "--config") ?? "eval.config.yaml"
  const yamlContent = await readFile(configPath, "utf-8")
  const rawConfig = loadEvalConfig(yamlContent as string)
  const config = applyFlagOverrides(rawConfig, argv)

  if (hasFlag(argv, "--dry-run")) {
    console.log("eval run --dry-run: resolved config:")
    console.log(JSON.stringify(config, null, 2))
    const scenarios = await loadEvalScenarios(process.cwd(), config.scenarios.ids)
    console.log(`Scenarios: ${scenarios.length}`)
    return
  }

  const scenarios = await loadEvalScenarios(process.cwd(), config.scenarios.ids)

  const fixtureManager = new FixtureManager({
    repo: config.fixtures.repo,
    manifest: config.fixtures.manifest,
    seedIfMissing: config.fixtures.seed_if_missing,
  })

  const githubToken = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? ""

  const hooks = createEvalHooks({
    fixtureManager,
    sessionExport: config.output.session_export,
  })

  for (const model of config.models) {
    const provider = new OpenCodeProvider({
      port: config.provider.port,
      model: model.id,
    })

    await runProfileSuite({
      modes: config.modes,
      // EvalScenario extends BaseScenario structurally; cast required due to module boundary
      scenarios: scenarios as unknown as ReadonlyArray<BaseScenario>,
      repetitions: config.execution.repetitions,
      outputPath: config.output.results_dir,
      provider,
      scorer: new CheckpointScorer(githubToken),
      modeResolver: new EvalModeResolver(),
      collectors: [new GhxCollector()],
      hooks,
    })
  }
}
