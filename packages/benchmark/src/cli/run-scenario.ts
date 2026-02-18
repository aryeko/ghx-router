import { spawn } from "node:child_process"
import { readFile, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { z } from "zod"
import { applyFixtureAppAuthIfConfigured, mintFixtureAppToken } from "../fixture/app-auth.js"
import { cleanupSeededFixtures } from "../fixture/cleanup.js"
import { loadFixtureManifest } from "../fixture/manifest.js"
import { seedFixtureManifest } from "../fixture/seed.js"
import { loadScenarios } from "../scenario/loader.js"
import { runIfDirectEntry } from "./entry.js"
import { hasFlag, parseFlagValue } from "./flag-utils.js"

type ParsedScenarioArgs = {
  scenario: string
  mode: string
  repo: string
  seedId: string
  retries: number
  iterations: number
  skipCleanup: boolean
  verbose: boolean
}

const scenarioIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
const modeSchema = z.enum(["ghx", "agent_direct", "mcp"])
const repoSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
const seedIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
const retriesSchema = z.coerce.number().int().min(0).max(10)
const iterationsSchema = z.coerce.number().int().min(1).max(20)

export function parseArgs(argv: string[]): ParsedScenarioArgs {
  const normalized = argv.filter((arg) => arg !== "--")

  const scenarioRaw = parseFlagValue(normalized, "--scenario")
  if (!scenarioRaw) {
    throw new Error("Missing required flag: --scenario")
  }
  const scenario = scenarioIdSchema.parse(scenarioRaw)

  const modeRaw = parseFlagValue(normalized, "--mode") ?? "ghx"
  const mode = modeSchema.parse(modeRaw)

  const repoRaw =
    parseFlagValue(normalized, "--repo") ??
    process.env.BENCH_FIXTURE_REPO ??
    "aryeko/ghx-bench-fixtures"
  const repo = repoSchema.parse(repoRaw)

  const seedIdRaw =
    parseFlagValue(normalized, "--seed-id") ??
    process.env.BENCH_FIXTURE_SEED_ID ??
    `scenario-${Date.now()}`
  const seedId = seedIdSchema.parse(seedIdRaw)

  const retriesRaw = parseFlagValue(normalized, "--retries") ?? "1"
  const retries = retriesSchema.parse(retriesRaw)

  const iterationsRaw = parseFlagValue(normalized, "--iterations") ?? "1"
  const iterations = iterationsSchema.parse(iterationsRaw)

  const skipCleanup = hasFlag(normalized, "--skip-cleanup")
  const verbose = hasFlag(normalized, "--verbose")

  return { scenario, mode, repo, seedId, retries, iterations, skipCleanup, verbose }
}

function loadEnvLocal(): void {
  try {
    process.loadEnvFile(resolve(import.meta.dirname ?? ".", "../../.env.local"))
  } catch {
    // .env.local is optional
  }
}

function log(phase: string, message: string): void {
  console.log(`[${phase}] ${message}`)
}

type ScenarioMeta = {
  timeoutMs: number
  requires: string[]
}

async function resolveScenarioMeta(scenarioId: string): Promise<ScenarioMeta> {
  const scenariosDir = resolve(import.meta.dirname ?? ".", "../../scenarios")
  const scenarios = await loadScenarios(scenariosDir)
  const match = scenarios.find((s) => s.id === scenarioId)
  return {
    timeoutMs: match?.timeout_ms ?? 180_000,
    requires: match?.fixture?.requires ?? [],
  }
}

async function checkJsonlResults(jsonlPath: string): Promise<boolean> {
  try {
    const content = await readFile(jsonlPath, "utf8")
    const lines = content.trim().split("\n").filter(Boolean)
    return lines.every((line) => {
      const row = JSON.parse(line) as { success?: boolean }
      return row.success === true
    })
  } catch {
    return false
  }
}

function spawnBenchmark(
  args: ParsedScenarioArgs,
  manifestPath: string,
  stallTimeoutMs: number,
  outputJsonlPath: string,
  skipWarmup: boolean,
): Promise<{ code: number; scenarioSuccess: boolean }> {
  const benchmarkArgs = [
    "src/cli/benchmark.ts",
    "run",
    args.mode,
    "1",
    "--scenario",
    args.scenario,
    "--fixture-manifest",
    manifestPath,
    ...(skipWarmup ? ["--skip-warmup"] : []),
    "--output-jsonl",
    outputJsonlPath,
  ]

  const child = spawn("tsx", benchmarkArgs, {
    cwd: resolve(import.meta.dirname ?? ".", "../.."),
    env: {
      ...process.env,
      BENCH_SESSION_STALL_TIMEOUT_MS: String(stallTimeoutMs),
    },
    stdio: args.verbose ? "inherit" : ["ignore", "pipe", "pipe"],
  })

  if (!args.verbose) {
    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim()
      if (text) console.log(`[run] ${text}`)
    })
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim()
      if (text) console.error(`[run] ${text}`)
    })
  }

  return new Promise((resolvePromise) => {
    child.once("exit", async (code) => {
      try {
        const scenarioSuccess = code === 0 && (await checkJsonlResults(outputJsonlPath))
        resolvePromise({ code: code ?? 1, scenarioSuccess })
      } catch {
        resolvePromise({ code: code ?? 1, scenarioSuccess: false })
      }
    })
    child.once("error", () => {
      resolvePromise({ code: 1, scenarioSuccess: false })
    })
  })
}

async function seedPhase(
  args: ParsedScenarioArgs,
  manifestPath: string,
  requires: string[],
): Promise<void> {
  log(
    "seed",
    `Seeding fixtures for ${args.repo} (seed-id: ${args.seedId}, requires: [${requires.join(", ")}])`,
  )
  const reviewerToken = await mintFixtureAppToken()
  const manifest = await seedFixtureManifest(
    { repo: args.repo, outFile: manifestPath, seedId: args.seedId, requires },
    reviewerToken,
  )
  log("seed", `Seeded fixtures for ${manifest.repo.full_name} -> ${manifestPath}`)
}

async function cleanupPhase(manifestPath: string): Promise<void> {
  const restoreAuth = await applyFixtureAppAuthIfConfigured()
  try {
    const manifest = await loadFixtureManifest(manifestPath)
    const result = await cleanupSeededFixtures(manifest)
    await rm(manifestPath, { force: true })
    log(
      "cleanup",
      `Closed ${result.closedIssues} issue(s), ${result.closedPrs} PR(s), deleted ${result.deletedBranches} branch(es), removed manifest`,
    )
  } finally {
    restoreAuth()
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  loadEnvLocal()
  const args = parseArgs(argv)

  const meta = await resolveScenarioMeta(args.scenario)
  const stallTimeoutMs = Math.floor(meta.timeoutMs / 3)

  log("plan", `scenario=${args.scenario} mode=${args.mode} retries=${args.retries}`)
  log("plan", `iterations=${args.iterations} timeout=${meta.timeoutMs}ms stall=${stallTimeoutMs}ms`)

  const outputJsonlPath = resolve(
    import.meta.dirname ?? ".",
    `../../results/scenario-${args.seedId}.jsonl`,
  )

  let failedIterations = 0
  let warmedUp = false

  for (let iter = 1; iter <= args.iterations; iter++) {
    const iterSeedId = args.iterations === 1 ? args.seedId : `${args.seedId}-iter-${iter}`
    const manifestPath = resolve(
      import.meta.dirname ?? ".",
      `../../fixtures/scenario-${iterSeedId}.json`,
    )

    if (args.iterations > 1) {
      log("iter", `iteration ${iter}/${args.iterations}: seeding fresh fixtures`)
    }

    let iterSuccess = false
    const maxAttempts = 1 + args.retries

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        log("retry", `Attempt ${attempt}/${maxAttempts}: cleaning up and re-seeding`)
        try {
          await cleanupPhase(manifestPath)
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          log("retry", `Cleanup before retry failed (continuing): ${message}`)
        }
      }

      await seedPhase({ ...args, seedId: iterSeedId }, manifestPath, meta.requires)

      log("run", `Starting benchmark (attempt ${attempt}/${maxAttempts})`)
      const result = await spawnBenchmark(
        args,
        manifestPath,
        stallTimeoutMs,
        outputJsonlPath,
        warmedUp,
      )
      warmedUp = true
      iterSuccess = result.scenarioSuccess

      if (result.scenarioSuccess) {
        log("run", "Benchmark passed (scenario success verified from results)")
        break
      }

      log(
        "run",
        `Benchmark failed (exit code ${result.code}, scenario success=${result.scenarioSuccess})`,
      )
    }

    if (!iterSuccess) {
      failedIterations++
    }

    if (!args.skipCleanup) {
      log("cleanup", args.iterations > 1 ? `Cleanup for iteration ${iter}` : "Final cleanup")
      try {
        await cleanupPhase(manifestPath)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        log("cleanup", `Cleanup failed: ${message}`)
      }
    }
  }

  if (failedIterations > 0) {
    throw new Error(
      `Scenario ${args.scenario} failed ${failedIterations}/${args.iterations} iteration(s)`,
    )
  }
}

runIfDirectEntry(import.meta.url, main)
