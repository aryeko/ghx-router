import { readFile } from "node:fs/promises"
import { GhxCollector } from "@eval/collector/ghx-collector.js"
import { loadEvalConfig } from "@eval/config/loader.js"
import type { EvalConfig } from "@eval/config/schema.js"
import { FixtureManager } from "@eval/fixture/manager.js"
import { loadFixtureManifest } from "@eval/fixture/manifest.js"
import { createEvalHooks } from "@eval/hooks/eval-hooks.js"
import { EvalModeResolver } from "@eval/mode/resolver.js"
import { OpenCodeProvider } from "@eval/provider/opencode-provider.js"
import { loadEvalScenarios } from "@eval/scenario/loader.js"
import { CheckpointScorer } from "@eval/scorer/checkpoint-scorer.js"
import { runProfileSuite } from "@ghx-dev/agent-profiler"

function parseFlag(argv: readonly string[], flag: string): string | null {
  const idx = argv.indexOf(flag)
  if (idx === -1 || idx + 1 >= argv.length) return null
  return argv[idx + 1] ?? null
}

function parseMultiFlag(argv: readonly string[], flag: string): string[] {
  const values: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === flag && i + 1 < argv.length) {
      const next = argv[i + 1]
      if (next !== undefined) {
        values.push(next)
      }
    }
  }
  return values
}

function applyFlagOverrides(config: EvalConfig, argv: readonly string[]): EvalConfig {
  let result: EvalConfig = config

  const models = parseMultiFlag(argv, "--model")
  if (models.length > 0) {
    result = {
      ...result,
      models: models.map((id) => ({ id, label: id })),
    }
  }

  const modes = parseMultiFlag(argv, "--mode")
  if (modes.length > 0) {
    result = { ...result, modes }
  }

  const scenarios = parseMultiFlag(argv, "--scenario")
  if (scenarios.length > 0) {
    result = {
      ...result,
      scenarios: { ...result.scenarios, ids: scenarios },
    }
  }

  const scenarioSet = parseFlag(argv, "--scenario-set")
  if (scenarioSet !== null) {
    result = {
      ...result,
      scenarios: { ...result.scenarios, set: scenarioSet },
    }
  }

  const repetitionsStr = parseFlag(argv, "--repetitions")
  if (repetitionsStr !== null) {
    const repetitions = Number(repetitionsStr)
    if (!Number.isNaN(repetitions) && repetitions > 0) {
      result = {
        ...result,
        execution: { ...result.execution, repetitions },
      }
    }
  }

  if (argv.includes("--skip-warmup")) {
    result = {
      ...result,
      execution: { ...result.execution, warmup: false },
    }
  }

  if (argv.includes("--seed-if-missing")) {
    result = {
      ...result,
      fixtures: { ...result.fixtures, seed_if_missing: true },
    }
  }

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

  if (argv.includes("--dry-run")) {
    console.log("eval run --dry-run: resolved config:")
    console.log(JSON.stringify(config, null, 2))
    const scenarios = await loadEvalScenarios(
      config.scenarios.ids ? process.cwd() : process.cwd(),
      config.scenarios.ids,
    )
    console.log(`Scenarios: ${scenarios.length}`)
    return
  }

  const scenarios = await loadEvalScenarios(process.cwd(), config.scenarios.ids)

  const fixtureManifest = await loadFixtureManifest(config.fixtures.manifest).catch(() => null)

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
      scenarios: scenarios as never,
      repetitions: config.execution.repetitions,
      outputPath: config.output.results_dir,
      provider,
      scorer: new CheckpointScorer(githubToken),
      modeResolver: new EvalModeResolver(),
      collectors: [new GhxCollector()],
      hooks,
    })
  }

  void fixtureManifest
}
