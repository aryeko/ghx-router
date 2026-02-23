import { access } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import type { BenchmarkMode, Scenario } from "../domain/types.js"
import { mintFixtureAppToken } from "../fixture/app-auth.js"
import { loadFixtureManifest } from "../fixture/manifest.js"
import { seedFixtureManifest } from "../fixture/seeder.js"
import { buildBenchRunTs } from "../runner/iter-log-context.js"
import { type ProgressEvent, runSuite } from "../runner/suite.js"
import { loadScenarioSets, loadScenarios } from "../scenario/loader.js"
import { parseFlagValue, parseMultiFlagValues, parseStrictFlagValue } from "./flag-utils.js"

function isBenchmarkMode(value: string): boolean {
  return ["agent_direct", "mcp", "ghx"].includes(value)
}

function stripForwardingSeparator(args: string[]): string[] {
  return args.filter((arg) => arg !== "--")
}

function splitPositionalAndFlags(args: string[]): {
  positional: string[]
  flags: string[]
} {
  const positional: string[] = []
  const flags: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index]
    if (!current) {
      continue
    }

    if (current.startsWith("--")) {
      flags.push(current)
      if (!current.includes("=")) {
        const next = args[index + 1]
        if (typeof next === "string" && !next.startsWith("--")) {
          flags.push(next)
          index += 1
        }
      }
      continue
    }

    positional.push(current)
  }

  return { positional, flags }
}

const parsedCliArgsSchema = z
  .object({
    mode: z.enum(["agent_direct", "mcp", "ghx"]),
    repetitions: z.number().int().min(1),
    scenarioFilter: z.array(z.string().min(1)).min(1).nullable(),
    scenarioSet: z.string().min(1).nullable(),
    fixtureManifestPath: z.string().min(1).nullable(),
    seedIfMissing: z.boolean(),
    providerId: z.string().min(1).nullable(),
    modelId: z.string().min(1).nullable(),
    outputJsonlPath: z.string().min(1).nullable(),
    skipWarmup: z.boolean(),
  })
  .refine((value) => !(value.scenarioFilter && value.scenarioSet), {
    message: "--scenario and --scenario-set cannot be used together",
  })

function parseCliArgs(argv: string[]): z.infer<typeof parsedCliArgsSchema> {
  const normalized = stripForwardingSeparator(argv)
  const { positional, flags } = splitPositionalAndFlags(normalized)
  const [modeRaw = "ghx", repetitionsRaw = "1"] = positional

  const mode = modeRaw as BenchmarkMode

  if (!isBenchmarkMode(mode)) {
    throw new Error(`Unsupported mode: ${mode}`)
  }

  const repetitions = Number(repetitionsRaw)
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new Error(`Invalid repetitions: ${repetitionsRaw}`)
  }

  const scenarioValues = parseMultiFlagValues(flags, "--scenario")
  const scenarioFilter = scenarioValues.length > 0 ? scenarioValues : null

  const parsed = parsedCliArgsSchema.parse({
    mode,
    repetitions,
    scenarioFilter,
    scenarioSet: parseFlagValue(flags, "--scenario-set"),
    fixtureManifestPath: parseFlagValue(flags, "--fixture-manifest"),
    seedIfMissing: flags.includes("--seed-if-missing"),
    providerId: parseStrictFlagValue(flags, "--provider"),
    modelId: parseStrictFlagValue(flags, "--model"),
    outputJsonlPath: parseStrictFlagValue(flags, "--output-jsonl"),
    skipWarmup: flags.includes("--skip-warmup"),
  })

  return parsed
}

const DEFAULT_FIXTURE_MANIFEST_PATH = "fixtures/latest.json"
const SCENARIOS_DIR = join(process.cwd(), "scenarios")
const RESULTS_DIR = join(process.cwd(), "results")

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const benchRunTs = buildBenchRunTs()
  const benchLogsDir = process.env.BENCH_LOGS_DIR ?? null
  const parsed = parseCliArgs(argv)

  const scenarios = await loadScenarios(SCENARIOS_DIR)

  if (scenarios.length === 0) {
    throw new Error(
      parsed.scenarioFilter
        ? `No scenarios matched filter: ${parsed.scenarioFilter.join(",")}`
        : "No benchmark scenarios found",
    )
  }

  let allSelectedScenarios: Scenario[]
  let resolvedScenarioSet: string | null

  if (parsed.scenarioFilter) {
    const selectedIds = new Set(parsed.scenarioFilter)
    allSelectedScenarios = scenarios.filter((scenario) => selectedIds.has(scenario.id))
    resolvedScenarioSet = null
  } else {
    const scenarioSets = await loadScenarioSets(process.cwd())
    const selectedSetName = parsed.scenarioSet ?? "default"
    const selectedScenarioIds = scenarioSets[selectedSetName]
    if (!selectedScenarioIds) {
      throw new Error(`Unknown scenario set: ${selectedSetName}`)
    }

    const unknownScenarioIds = selectedScenarioIds.filter(
      (scenarioId) => !scenarios.some((scenario) => scenario.id === scenarioId),
    )
    if (unknownScenarioIds.length > 0) {
      throw new Error(
        `Scenario set '${selectedSetName}' references unknown scenario id(s): ${unknownScenarioIds.join(", ")}`,
      )
    }

    allSelectedScenarios = selectedScenarioIds.map(
      (scenarioId) => scenarios.find((scenario) => scenario.id === scenarioId) as Scenario,
    )
    resolvedScenarioSet = selectedSetName
  }

  if (allSelectedScenarios.length === 0) {
    throw new Error(
      `No scenarios matched filter: ${parsed.scenarioFilter ?? parsed.scenarioSet ?? "default"}`,
    )
  }

  const selectedScenarios = allSelectedScenarios

  const needsReseed = selectedScenarios.some((s) => s.fixture?.reseed_per_iteration === true)

  let reviewerToken: string | null = null
  if (needsReseed) {
    reviewerToken = await mintFixtureAppToken()
    if (reviewerToken === null) {
      console.warn(
        "[benchmark] warn: reseed_per_iteration scenarios detected but no reviewer token. " +
          "Resets will be skipped. Configure BENCH_FIXTURE_GH_APP_* env vars to enable.",
      )
    }
  }

  const needsFixtureBindings = selectedScenarios.some((scenario) => {
    const bindings = scenario.fixture?.bindings
    return !!bindings && Object.keys(bindings).length > 0
  })

  let fixtureManifestPath = parsed.fixtureManifestPath
  if (!fixtureManifestPath && needsFixtureBindings) {
    try {
      await access(DEFAULT_FIXTURE_MANIFEST_PATH)
      fixtureManifestPath = DEFAULT_FIXTURE_MANIFEST_PATH
    } catch {
      if (parsed.seedIfMissing) {
        fixtureManifestPath = DEFAULT_FIXTURE_MANIFEST_PATH
      } else {
        throw new Error(
          `Selected scenarios require fixture bindings but no fixture manifest was provided. Pass --fixture-manifest or create ${DEFAULT_FIXTURE_MANIFEST_PATH}.`,
        )
      }
    }
  }

  if (parsed.seedIfMissing && !fixtureManifestPath) {
    throw new Error("--seed-if-missing requires --fixture-manifest")
  }

  let fixtureManifest = null
  if (fixtureManifestPath) {
    let fixtureManifestExists = true
    try {
      await access(fixtureManifestPath)
    } catch {
      fixtureManifestExists = false
    }

    if (!fixtureManifestExists) {
      if (!parsed.seedIfMissing) {
        throw new Error(`Fixture manifest not found: ${fixtureManifestPath}`)
      }

      const seedSourceRepo = process.env.BENCH_FIXTURE_REPO ?? "aryeko/ghx-bench-fixtures"

      const requiredResources = new Set<string>()
      for (const scenario of selectedScenarios) {
        if (scenario.fixture?.requires) {
          for (const r of scenario.fixture.requires) {
            requiredResources.add(r)
          }
        }
      }

      await seedFixtureManifest(
        {
          repo: seedSourceRepo,
          outFile: fixtureManifestPath,
          seedId: process.env.BENCH_FIXTURE_SEED_ID ?? "default",
          ...(requiredResources.size > 0 ? { requires: [...requiredResources] } : {}),
        },
        reviewerToken,
      )
    }

    fixtureManifest = await loadFixtureManifest(fixtureManifestPath)
  }

  const outFile =
    parsed.outputJsonlPath ?? join(RESULTS_DIR, `${benchRunTs}-${parsed.mode}-suite.jsonl`)

  const providerId = parsed.providerId ?? process.env.BENCH_PROVIDER_ID ?? "openai"
  const modelId = parsed.modelId ?? process.env.BENCH_MODEL_ID ?? "gpt-5.1-codex-mini"

  const onProgress = (event: ProgressEvent): void => {
    if (process.env.BENCH_PROGRESS_EVENTS !== "jsonl") {
      return
    }
    console.log(JSON.stringify(event))
  }

  await runSuite({
    modes: [parsed.mode],
    scenarios: selectedScenarios,
    repetitions: parsed.repetitions,
    manifest: fixtureManifest,
    outputJsonlPath: outFile,
    onProgress,
    providerConfig: { type: "opencode", providerId, modelId },
    skipWarmup: parsed.skipWarmup,
    scenarioSet: resolvedScenarioSet,
    reviewerToken,
    benchRunTs,
    benchLogsDir,
  })
}
