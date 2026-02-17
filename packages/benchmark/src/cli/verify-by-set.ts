import { spawn } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"
import { z } from "zod"

import { loadScenarioSets } from "../scenario/loader.js"

type SeedPolicy = "with_seed" | "read_only"

type ParsedArgs = {
  set: string
  provider: string
  model: string
  repetitions: number
  outDir: string
  scenarioIds: string[]
  skipPreflight: boolean
}

type ValidationSummary = {
  rowsActual: number
  checks: {
    success: { pass: number; fail: number }
    outputValid: { pass: number; fail: number }
    errorNull: { pass: number; fail: number }
  }
  failingScenarioIds: string[]
}

type SuiteRow = {
  scenario_id?: string
  iteration?: unknown
  success?: unknown
  output_valid?: unknown
  error?: unknown
}

type Tracking = {
  set: string
  provider: string
  model: string
  resolved_scenarios: string[]
  rows_expected: {
    agent_direct: number
    ghx: number
  }
  rows_actual: {
    agent_direct: number
    ghx: number
  }
  checks: {
    success: { pass: number; fail: number }
    output_valid: { pass: number; fail: number }
    error_null: { pass: number; fail: number }
  }
  failing_scenarios: string[]
  reruns: Array<{
    attempt: number
    scenario_ids: string[]
    result: "pass" | "fail"
  }>
  final_status: "pass" | "fail" | "terminal_fail"
}

type RunCommand = (command: string, args: string[]) => Promise<void>

type VerifyDependencies = {
  runCommand?: RunCommand
  resolveScenarioIdsForSet?: (set: string) => Promise<string[]>
}

type SuiteConfigCommand = {
  command: string[]
  env?: Record<string, string>
}

type SuiteConfig = {
  benchmark: {
    base: {
      command: string[]
      repetitions: number
      scenarioSet?: string
      env?: Record<string, string>
    }
    ghx: {
      mode: "ghx"
      args?: string[]
      env?: Record<string, string>
    }
    direct: {
      mode: "agent_direct"
      args?: string[]
      env?: Record<string, string>
    }
  }
  reporting: {
    analysis: {
      report: SuiteConfigCommand
      gate?: SuiteConfigCommand
    }
  }
}

type AttemptPaths = {
  runRoot: string
  suiteConfigBasePath: string
  suiteConfigPath: string
  fixtureManifestPath: string
  agentSuitePath: string
  ghxSuitePath: string
}

const READ_ONLY_SETS = new Set(["ci-diagnostics", "ci-log-analysis"])
const DEFAULT_MODEL = "gpt-5.1-codex-mini"
const MAX_RERUN_ATTEMPTS = 2
const GATE_PROFILE = "verify_pr"

function parseFlagValue(args: string[], flag: string): string | null {
  const index = args.findIndex((arg) => arg === flag)
  if (index !== -1) {
    const value = (args[index + 1] ?? "").trim()
    if (value.length === 0 || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`)
    }
    return value
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`))
  if (inline) {
    const value = inline.slice(flag.length + 1).trim()
    if (value.length === 0) {
      throw new Error(`Missing value for ${flag}`)
    }
    return value
  }

  return null
}

function parseMultiFlagValues(args: string[], flag: string): string[] {
  const values: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index]
    if (!current) {
      continue
    }

    if (current === flag) {
      const next = (args[index + 1] ?? "").trim()
      if (next.length === 0 || next.startsWith("--")) {
        throw new Error(`Missing value for ${flag}`)
      }
      values.push(next)
      index += 1
      continue
    }

    const inlinePrefix = `${flag}=`
    if (current.startsWith(inlinePrefix)) {
      const value = current.slice(inlinePrefix.length).trim()
      if (value.length === 0) {
        throw new Error(`Missing value for ${flag}`)
      }
      values.push(value)
    }
  }

  return values
}

function runId(): string {
  return new Date().toISOString().replace(/[-:.]/g, "")
}

function defaultOutDir(set: string, model: string): string {
  const day = new Date().toISOString().slice(0, 10)
  const modelSegment = model.replace(/[^a-zA-Z0-9._-]+/g, "-")
  return `reports/verification-${day}-${modelSegment}-by-set/${set}`
}

const parsedArgsSchema = z.object({
  set: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  repetitions: z.number().int().min(1),
  outDir: z.string().min(1),
  scenarioIds: z.array(z.string().min(1)),
  skipPreflight: z.boolean(),
})

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.filter((arg) => arg !== "--")
  const set = parseFlagValue(args, "--set")
  const provider = parseFlagValue(args, "--provider")
  const model = parseFlagValue(args, "--model") ?? DEFAULT_MODEL
  const repetitionsRaw = parseFlagValue(args, "--repetitions") ?? "1"
  const repetitions = Number.parseInt(repetitionsRaw, 10)
  const outDir = parseFlagValue(args, "--out-dir") ?? defaultOutDir(set ?? "unknown", model)

  if (!set) {
    throw new Error("Missing value for --set")
  }
  if (!provider) {
    throw new Error("Missing value for --provider")
  }
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new Error("Invalid value for --repetitions")
  }

  return parsedArgsSchema.parse({
    set,
    provider,
    model,
    repetitions,
    outDir,
    scenarioIds: parseMultiFlagValues(args, "--scenario-id"),
    skipPreflight: args.includes("--skip-preflight"),
  })
}

export function resolveSeedPolicy(set: string): SeedPolicy {
  return READ_ONLY_SETS.has(set) ? "read_only" : "with_seed"
}

function parseSuiteRows(content: string): SuiteRow[] {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return lines.map((line) => JSON.parse(line) as SuiteRow)
}

function summarizeSuiteRows(rows: SuiteRow[]): ValidationSummary {
  const failingScenarioIds = new Set<string>()

  const checks = {
    success: { pass: 0, fail: 0 },
    outputValid: { pass: 0, fail: 0 },
    errorNull: { pass: 0, fail: 0 },
  }

  for (const row of rows) {
    const scenarioId = typeof row.scenario_id === "string" ? row.scenario_id : "unknown"

    const successValid = row.success === true
    const outputValidValid = row.output_valid === true
    const errorNullValid = row.error === null

    if (successValid) checks.success.pass += 1
    else checks.success.fail += 1
    if (outputValidValid) checks.outputValid.pass += 1
    else checks.outputValid.fail += 1
    if (errorNullValid) checks.errorNull.pass += 1
    else checks.errorNull.fail += 1

    if (!successValid || !outputValidValid || !errorNullValid) {
      failingScenarioIds.add(scenarioId)
    }
  }

  return {
    rowsActual: rows.length,
    checks,
    failingScenarioIds: Array.from(failingScenarioIds).sort(),
  }
}

async function readSuiteRows(filePath: string): Promise<SuiteRow[]> {
  const content = await readFile(filePath, "utf8")
  return parseSuiteRows(content)
}

function rowsByScenarioId(rows: SuiteRow[]): Map<string, SuiteRow> {
  const byScenario = new Map<string, SuiteRow>()
  let unknownCounter = 0

  for (const [index, row] of rows.entries()) {
    const scenarioId =
      typeof row.scenario_id === "string" && row.scenario_id.length > 0
        ? row.scenario_id
        : `unknown-${unknownCounter++}`
    const iteration = Number.isInteger(row.iteration) ? Number(row.iteration) : index + 1
    byScenario.set(`${scenarioId}:${iteration}`, row)
  }

  return byScenario
}

function mergeScenarioRows(target: Map<string, SuiteRow>, rows: SuiteRow[]): void {
  for (const [scenarioId, row] of rowsByScenarioId(rows)) {
    target.set(scenarioId, row)
  }
}

async function writeSuiteRows(filePath: string, rows: SuiteRow[]): Promise<void> {
  const content = rows.map((row) => JSON.stringify(row)).join("\n")
  await writeFile(filePath, content.length > 0 ? `${content}\n` : "", "utf8")
}

export async function validateSuiteRows(filePath: string): Promise<ValidationSummary> {
  const rows = await readSuiteRows(filePath)
  return summarizeSuiteRows(rows)
}

async function runSpawn(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" })
    child.once("error", reject)
    child.once("exit", (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${command} failed with exit code ${code ?? 1}`))
    })
  })
}

async function defaultResolveScenarioIdsForSet(set: string): Promise<string[]> {
  const sets = await loadScenarioSets(process.cwd())
  const ids = sets[set]
  if (!ids) {
    throw new Error(`Unknown scenario set: ${set}`)
  }
  return ids
}

function buildRunScopedPaths(parsed: ParsedArgs, runBaseId: string, attempt: number): AttemptPaths {
  const runRoot = join(parsed.outDir, "_run", runBaseId)

  return {
    runRoot,
    suiteConfigBasePath: join(runRoot, `attempt-${attempt}.base.json`),
    suiteConfigPath: join(runRoot, `attempt-${attempt}.suite.json`),
    fixtureManifestPath: join(runRoot, "fixtures", "latest.json"),
    agentSuitePath: join(parsed.outDir, "agent_direct-suite.jsonl"),
    ghxSuitePath: join(parsed.outDir, "ghx-suite.jsonl"),
  }
}

async function generateBaseSuiteConfig(
  runner: RunCommand,
  parsed: ParsedArgs,
  paths: AttemptPaths,
): Promise<void> {
  await runner("pnpm", [
    "--filter",
    "@ghx-dev/benchmark",
    "run",
    "suite:config",
    "--",
    "--out",
    paths.suiteConfigBasePath,
    "--scenario-set",
    parsed.set,
    "--repetitions",
    String(parsed.repetitions),
    "--gate-profile",
    GATE_PROFILE,
    "--no-gate",
  ])
}

function scenarioSelectorArgs(scenarioIds: string[]): string[] {
  const args: string[] = []
  for (const scenarioId of scenarioIds) {
    args.push("--scenario", scenarioId)
  }
  return args
}

async function materializeAttemptConfig(
  parsed: ParsedArgs,
  paths: AttemptPaths,
  scenarioIds: string[],
): Promise<void> {
  const rawConfig = await readFile(paths.suiteConfigBasePath, "utf8")
  const config = JSON.parse(rawConfig) as SuiteConfig

  config.benchmark.base.env = {
    ...(config.benchmark.base.env ?? {}),
    BENCH_FIXTURE_MANIFEST: paths.fixtureManifestPath,
  }
  if (scenarioIds.length > 0) {
    delete config.benchmark.base.scenarioSet
  } else {
    config.benchmark.base.scenarioSet = parsed.set
  }

  config.benchmark.ghx.args = [
    "--provider",
    parsed.provider,
    "--model",
    parsed.model,
    "--output-jsonl",
    paths.ghxSuitePath,
    ...scenarioSelectorArgs(scenarioIds),
  ]
  config.benchmark.direct.args = [
    "--provider",
    parsed.provider,
    "--model",
    parsed.model,
    "--output-jsonl",
    paths.agentSuitePath,
    ...scenarioSelectorArgs(scenarioIds),
  ]

  config.reporting.analysis.report = {
    command: [
      "pnpm",
      "run",
      "report",
      "--",
      "--gate",
      "--gate-profile",
      GATE_PROFILE,
      "--suite-jsonl",
      paths.agentSuitePath,
      "--suite-jsonl",
      paths.ghxSuitePath,
      "--summary-json",
      join(parsed.outDir, "latest-summary.json"),
      "--summary-md",
      join(parsed.outDir, "latest-summary.md"),
    ],
  }
  delete config.reporting.analysis.gate

  await mkdir(dirname(paths.suiteConfigPath), { recursive: true })
  await writeFile(paths.suiteConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
}

async function runAttemptViaSuiteRunner(runner: RunCommand, paths: AttemptPaths): Promise<void> {
  await runner("pnpm", [
    "--filter",
    "@ghx-dev/benchmark",
    "run",
    "suite:run",
    "--",
    "--config",
    paths.suiteConfigPath,
    "--skip-cleanup",
    "--skip-seed",
    "--no-gate",
  ])
}

export async function runVerifySet(
  parsed: ParsedArgs,
  dependencies: VerifyDependencies = {},
): Promise<void> {
  const runner = dependencies.runCommand ?? runSpawn
  const resolveScenarioIdsForSet =
    dependencies.resolveScenarioIdsForSet ?? defaultResolveScenarioIdsForSet
  const seedPolicy = resolveSeedPolicy(parsed.set)
  const resolvedScenarioIds =
    parsed.scenarioIds.length > 0 ? parsed.scenarioIds : await resolveScenarioIdsForSet(parsed.set)
  const runBaseId = runId()
  const seedId = `${runBaseId}-${parsed.set}-seed`
  const runScopedPaths = buildRunScopedPaths(parsed, runBaseId, 0)

  await mkdir(parsed.outDir, { recursive: true })
  await mkdir(dirname(runScopedPaths.fixtureManifestPath), { recursive: true })

  if (!parsed.skipPreflight) {
    await runner("pnpm", [
      "--filter",
      "@ghx-dev/benchmark",
      "run",
      "fixtures",
      "--",
      "status",
      "--out",
      runScopedPaths.fixtureManifestPath,
    ])
  }

  if (seedPolicy === "with_seed" && parsed.scenarioIds.length === 0) {
    await runner("pnpm", [
      "--filter",
      "@ghx-dev/benchmark",
      "run",
      "fixtures",
      "--",
      "seed",
      "--seed-id",
      seedId,
      "--out",
      runScopedPaths.fixtureManifestPath,
    ])
  }

  const agentSuite = runScopedPaths.agentSuitePath
  const ghxSuite = runScopedPaths.ghxSuitePath

  const runAttempt = async (attempt: number, scenarioIds: string[]): Promise<void> => {
    const attemptPaths = buildRunScopedPaths(parsed, runBaseId, attempt)
    await writeFile(agentSuite, "", "utf8")
    await writeFile(ghxSuite, "", "utf8")
    await generateBaseSuiteConfig(runner, parsed, attemptPaths)
    await materializeAttemptConfig(parsed, attemptPaths, scenarioIds)
    await runAttemptViaSuiteRunner(runner, attemptPaths)
  }

  await runAttempt(0, parsed.scenarioIds)

  const finalAgentRows = rowsByScenarioId(await readSuiteRows(agentSuite))
  const finalGhxRows = rowsByScenarioId(await readSuiteRows(ghxSuite))
  let agentValidation = summarizeSuiteRows(Array.from(finalAgentRows.values()))
  let ghxValidation = summarizeSuiteRows(Array.from(finalGhxRows.values()))
  let failingScenarios = Array.from(
    new Set([...agentValidation.failingScenarioIds, ...ghxValidation.failingScenarioIds]),
  ).sort()

  const reruns: Tracking["reruns"] = []
  for (
    let attempt = 1;
    attempt <= MAX_RERUN_ATTEMPTS && failingScenarios.length > 0;
    attempt += 1
  ) {
    const scenarioIdsForAttempt = [...failingScenarios]
    await runAttempt(attempt, scenarioIdsForAttempt)

    mergeScenarioRows(finalAgentRows, await readSuiteRows(agentSuite))
    mergeScenarioRows(finalGhxRows, await readSuiteRows(ghxSuite))
    agentValidation = summarizeSuiteRows(Array.from(finalAgentRows.values()))
    ghxValidation = summarizeSuiteRows(Array.from(finalGhxRows.values()))
    failingScenarios = Array.from(
      new Set([...agentValidation.failingScenarioIds, ...ghxValidation.failingScenarioIds]),
    ).sort()

    reruns.push({
      attempt,
      scenario_ids: scenarioIdsForAttempt,
      result: failingScenarios.length === 0 ? "pass" : "fail",
    })
  }

  await writeSuiteRows(agentSuite, Array.from(finalAgentRows.values()))
  await writeSuiteRows(ghxSuite, Array.from(finalGhxRows.values()))

  const expectedRowsPerMode = resolvedScenarioIds.length * parsed.repetitions
  const rowCountMismatch =
    agentValidation.rowsActual !== expectedRowsPerMode ||
    ghxValidation.rowsActual !== expectedRowsPerMode
  if (rowCountMismatch) {
    const rowCountIssue = `row-count-mismatch: expected=${expectedRowsPerMode} agent_direct=${agentValidation.rowsActual} ghx=${ghxValidation.rowsActual}`
    if (!failingScenarios.includes(rowCountIssue)) {
      failingScenarios.push(rowCountIssue)
    }
  }
  failingScenarios.sort()

  const tracking: Tracking = {
    set: parsed.set,
    provider: parsed.provider,
    model: parsed.model,
    resolved_scenarios: resolvedScenarioIds,
    rows_expected: {
      agent_direct: expectedRowsPerMode,
      ghx: expectedRowsPerMode,
    },
    rows_actual: {
      agent_direct: agentValidation.rowsActual,
      ghx: ghxValidation.rowsActual,
    },
    checks: {
      success: {
        pass: agentValidation.checks.success.pass + ghxValidation.checks.success.pass,
        fail: agentValidation.checks.success.fail + ghxValidation.checks.success.fail,
      },
      output_valid: {
        pass: agentValidation.checks.outputValid.pass + ghxValidation.checks.outputValid.pass,
        fail: agentValidation.checks.outputValid.fail + ghxValidation.checks.outputValid.fail,
      },
      error_null: {
        pass: agentValidation.checks.errorNull.pass + ghxValidation.checks.errorNull.pass,
        fail: agentValidation.checks.errorNull.fail + ghxValidation.checks.errorNull.fail,
      },
    },
    failing_scenarios: failingScenarios,
    reruns,
    final_status: failingScenarios.length === 0 ? "pass" : "terminal_fail",
  }

  const trackingPath = join(parsed.outDir, "tracking.json")
  await mkdir(dirname(trackingPath), { recursive: true })
  await writeFile(trackingPath, `${JSON.stringify(tracking, null, 2)}\n`, "utf8")

  if (tracking.final_status !== "pass") {
    throw new Error(
      `Set ${parsed.set} failed blocking validation: ${tracking.failing_scenarios.join(",") || "unknown"}`,
    )
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv)
  await runVerifySet(parsed)
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
  })
}
