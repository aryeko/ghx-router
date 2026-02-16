import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import type { BenchmarkMode, BenchmarkRow } from "../domain/types.js"
import type { GateProfile } from "../report/aggregate.js"
import { buildSummary, DEFAULT_GATE_V2_THRESHOLDS, toMarkdown } from "../report/aggregate.js"
import {
  expectationsConfigExists,
  inferModelSignatureFromRows,
  loadExpectationsConfig,
  resolveGateThresholdsForModel,
  resolveModelForExpectations,
} from "../report/expectations.js"

const RESULTS_DIR = join(process.cwd(), "results")
const REPORTS_DIR = join(process.cwd(), "reports")
const DEFAULT_EXPECTATIONS_CONFIG = join(process.cwd(), "config", "expectations.json")

function parseGateProfile(args: string[]): GateProfile {
  const inline = args.find((arg) => arg.startsWith("--gate-profile="))
  if (inline) {
    const value = inline.slice("--gate-profile=".length)
    if (value === "verify_pr" || value === "verify_release") {
      return value
    }
    throw new Error("Unknown gate profile. Expected verify_pr or verify_release")
  }

  const index = args.findIndex((arg) => arg === "--gate-profile")
  if (index === -1) {
    return "verify_pr"
  }

  const value = args[index + 1]
  if (value === "verify_pr" || value === "verify_release") {
    return value
  }

  throw new Error("Unknown gate profile. Expected verify_pr or verify_release")
}

export function parseArgs(args: string[]): {
  gate: boolean
  gateProfile: GateProfile
  expectationsConfigProvided: boolean
  expectationsConfigPath: string | null
  expectationsModel: string | null
} {
  const parseStringFlag = (
    flagName: "expectations-config" | "expectations-model",
  ): { value: string | null; provided: boolean } => {
    const inlinePrefix = `--${flagName}=`
    const inline = args.find((arg) => arg.startsWith(inlinePrefix))
    const splitIndex = args.findIndex((arg) => arg === `--${flagName}`)

    const provided = inline !== undefined || splitIndex >= 0
    if (!provided) {
      return {
        value: null,
        provided: false,
      }
    }

    const rawValue =
      inline !== undefined ? inline.slice(inlinePrefix.length) : (args[splitIndex + 1] ?? "")
    const value = rawValue.trim()
    if (value.length === 0 || value.startsWith("--")) {
      throw new Error(`Missing value for --${flagName}`)
    }

    return {
      value,
      provided: true,
    }
  }

  const expectationsConfig = parseStringFlag("expectations-config")
  const expectationsModel = parseStringFlag("expectations-model")

  return {
    gate: args.includes("--gate"),
    gateProfile: parseGateProfile(args),
    expectationsConfigProvided: expectationsConfig.provided,
    expectationsConfigPath: expectationsConfig.value,
    expectationsModel: expectationsModel.value,
  }
}

export function modeFromFilename(name: string): BenchmarkMode | null {
  if (name.includes("-agent_direct-suite.jsonl")) return "agent_direct"
  if (name.includes("-mcp-suite.jsonl")) return "mcp"
  if (name.includes("-ghx-suite.jsonl")) return "ghx"
  return null
}

export async function readRows(filePath: string): Promise<BenchmarkRow[]> {
  const content = await readFile(filePath, "utf8")
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as BenchmarkRow)
}

export async function loadLatestRowsPerMode(): Promise<BenchmarkRow[]> {
  const entries = await readdir(RESULTS_DIR)
  const files = entries.filter((name) => name.endsWith("-suite.jsonl")).sort()
  const latestByMode = new Map<BenchmarkMode, string>()

  for (const name of files) {
    const mode = modeFromFilename(name)
    if (!mode) continue
    latestByMode.set(mode, name)
  }

  const rows: BenchmarkRow[] = []
  const rowsByMode = new Map<BenchmarkMode, BenchmarkRow[]>()
  for (const file of latestByMode.values()) {
    const mode = modeFromFilename(file)
    if (!mode) {
      continue
    }
    const fileRows = await readRows(join(RESULTS_DIR, file))
    rows.push(...fileRows)
    rowsByMode.set(mode, fileRows)
  }

  const agentRows = rowsByMode.get("agent_direct")
  const ghxRows = rowsByMode.get("ghx")
  if (agentRows && ghxRows) {
    validateComparableCohort(agentRows, ghxRows)
  }

  return rows
}

function uniqueScenarioSets(rows: BenchmarkRow[]): string {
  const values = Array.from(
    new Set(rows.map((row) => (row.scenario_set === null ? "<null>" : row.scenario_set))),
  ).sort()
  return values.join(",")
}

function uniqueScenarioIds(rows: BenchmarkRow[]): string {
  return Array.from(new Set(rows.map((row) => row.scenario_id)))
    .sort()
    .join(",")
}

function uniqueModelSignature(rows: BenchmarkRow[]): string {
  return Array.from(
    new Set(
      rows.map(
        (row) => `${row.model.provider_id}/${row.model.model_id}/${row.model.mode ?? "<null>"}`,
      ),
    ),
  )
    .sort()
    .join(",")
}

function uniqueGitCommits(rows: BenchmarkRow[]): string {
  return Array.from(new Set(rows.map((row) => row.git.commit ?? "<null>")))
    .sort()
    .join(",")
}

function validateComparableCohort(agentRows: BenchmarkRow[], ghxRows: BenchmarkRow[]): void {
  const checks: Array<{ name: string; left: string; right: string }> = [
    {
      name: "scenario_set",
      left: uniqueScenarioSets(agentRows),
      right: uniqueScenarioSets(ghxRows),
    },
    {
      name: "scenario_ids",
      left: uniqueScenarioIds(agentRows),
      right: uniqueScenarioIds(ghxRows),
    },
    {
      name: "model",
      left: uniqueModelSignature(agentRows),
      right: uniqueModelSignature(ghxRows),
    },
  ]

  const agentCommit = uniqueGitCommits(agentRows)
  const ghxCommit = uniqueGitCommits(ghxRows)
  if (agentCommit !== "<null>" && ghxCommit !== "<null>") {
    checks.push({ name: "git_commit", left: agentCommit, right: ghxCommit })
  }

  const mismatches = checks.filter((check) => check.left !== check.right)
  if (mismatches.length > 0) {
    const details = mismatches
      .map((mismatch) => `${mismatch.name}: agent_direct=${mismatch.left} ghx=${mismatch.right}`)
      .join("; ")
    throw new Error(`Latest benchmark files are not comparable across modes: ${details}`)
  }
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const {
    gate,
    gateProfile,
    expectationsConfigProvided,
    expectationsConfigPath,
    expectationsModel,
  } = parseArgs(args)
  const rows = await loadLatestRowsPerMode()

  if (rows.length === 0) {
    throw new Error("No benchmark result rows found")
  }

  const configPath = expectationsConfigPath ?? DEFAULT_EXPECTATIONS_CONFIG
  let expectationsModelResolved: string | null = null
  let gateThresholds = DEFAULT_GATE_V2_THRESHOLDS

  const hasExpectationsConfig = await expectationsConfigExists(configPath)
  if (!hasExpectationsConfig && expectationsConfigProvided) {
    throw new Error(`Expectations config not found at ${configPath}`)
  }

  if (hasExpectationsConfig) {
    const config = await loadExpectationsConfig(configPath)
    const inferredModel = inferModelSignatureFromRows(rows)
    expectationsModelResolved = resolveModelForExpectations(
      expectationsModel,
      inferredModel,
      config,
    )
    gateThresholds = resolveGateThresholdsForModel(config, expectationsModelResolved)
  } else if (expectationsModel) {
    throw new Error(`Expectations config not found at ${configPath}`)
  }

  const summary = buildSummary(rows, gateProfile, gateThresholds)
  const markdown = toMarkdown(summary)

  await mkdir(REPORTS_DIR, { recursive: true })
  await writeFile(
    join(REPORTS_DIR, "latest-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  )
  await writeFile(join(REPORTS_DIR, "latest-summary.md"), `${markdown}\n`, "utf8")

  console.log(`Wrote reports/latest-summary.json`)
  console.log(`Wrote reports/latest-summary.md`)

  if (gate) {
    const status = summary.gateV2.passed ? "PASS" : "FAIL"
    console.log(`Benchmark verify profile: ${gateProfile}`)
    const modeModels = ["agent_direct", "ghx"]
      .map((mode) => {
        const modelSignature = summary.modes[mode as BenchmarkMode]?.modelSignature
        return modelSignature ? `${mode}=${modelSignature}` : null
      })
      .filter((entry): entry is string => entry !== null)
    if (modeModels.length > 0) {
      console.log(`Benchmark model(s): ${modeModels.join("; ")}`)
    }
    if (expectationsModelResolved) {
      console.log(`Benchmark expectations model: ${expectationsModelResolved}`)
    }
    console.log(`Benchmark verify result: ${status}`)

    if (summary.gateV2.checks.length > 0) {
      for (const check of summary.gateV2.checks) {
        const marker = check.passed ? "PASS" : "FAIL"
        console.log(
          ` - [${marker}] ${check.name}: value=${check.value.toFixed(2)} ${check.operator} threshold=${check.threshold.toFixed(2)}`,
        )
      }
    }
  }

  if (gate && !summary.gateV2.passed) {
    throw new Error(`Benchmark gate failed for profile ${gateProfile}`)
  }
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
