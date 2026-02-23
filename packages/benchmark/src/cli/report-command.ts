import { appendFile, mkdir, readdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { benchmarkRowSchema } from "../domain/schemas.js"
import type { BenchmarkMode, BenchmarkRow, GateProfile, HistoryEntry } from "../domain/types.js"
import { buildSummary } from "../report/aggregate.js"
import {
  expectationsConfigExists,
  inferModelSignatureFromRows,
  loadExpectationsConfig,
  resolveGateThresholdsForModel,
  resolveModelForExpectations,
} from "../report/expectations.js"
import { toMarkdown } from "../report/formatter.js"
import { DEFAULT_GATE_THRESHOLDS } from "../report/gate.js"
import { detectRegressions, formatRegressionWarnings, loadHistory } from "../report/regression.js"
import { readJsonlFile } from "../util/jsonl.js"
import { parseFlagValue, parseMultiFlagValues } from "./flag-utils.js"

const RESULTS_DIR = join(process.cwd(), "results")
const REPORTS_DIR = join(process.cwd(), "reports")
const DEFAULT_EXPECTATIONS_CONFIG = join(process.cwd(), "config", "expectations.json")

function parseGateProfile(args: string[]): GateProfile {
  const value = parseFlagValue(args, "--gate-profile") ?? "verify_pr"
  if (value === "verify_pr" || value === "verify_release") {
    return value
  }
  throw new Error("Unknown gate profile. Expected verify_pr or verify_release")
}

function parseArgs(args: string[]): {
  gate: boolean
  gateProfile: GateProfile
  expectationsConfigProvided: boolean
  expectationsConfigPath: string | null
  expectationsModel: string | null
  summaryJsonPath: string | null
  summaryMdPath: string | null
  suiteJsonlPaths: string[]
} {
  return {
    gate: args.includes("--gate"),
    gateProfile: parseGateProfile(args),
    expectationsConfigProvided: args.some((arg) => arg.startsWith("--expectations-config")),
    expectationsConfigPath: parseFlagValue(args, "--expectations-config"),
    expectationsModel: parseFlagValue(args, "--expectations-model"),
    summaryJsonPath: parseFlagValue(args, "--summary-json"),
    summaryMdPath: parseFlagValue(args, "--summary-md"),
    suiteJsonlPaths: parseMultiFlagValues(args, "--suite-jsonl"),
  }
}

async function loadLatestRowsPerMode(): Promise<BenchmarkRow[]> {
  const files = await readdir(RESULTS_DIR)
  const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"))
  const latestPerMode: Record<string, { file: string; timestamp: string }> = {}

  for (const file of jsonlFiles) {
    const match = file.match(/^(.+?)-(agent_direct|mcp|ghx)-suite\.jsonl$/)
    if (!match) continue

    const timestamp = match[1]
    const mode = match[2]
    if (!timestamp || !mode) continue

    if (!latestPerMode[mode] || latestPerMode[mode].timestamp < timestamp) {
      latestPerMode[mode] = { file, timestamp }
    }
  }

  const rows: BenchmarkRow[] = []
  for (const { file } of Object.values(latestPerMode)) {
    const fileRows = await readJsonlFile(join(RESULTS_DIR, file), benchmarkRowSchema)
    rows.push(...(fileRows as BenchmarkRow[]))
  }

  return rows
}

async function loadRowsFromSuiteFiles(filePaths: string[]): Promise<BenchmarkRow[]> {
  const rows: BenchmarkRow[] = []
  for (const filePath of filePaths) {
    const fileRows = await readJsonlFile(filePath, benchmarkRowSchema)
    rows.push(...(fileRows as BenchmarkRow[]))
  }
  return rows
}

function extractGitInfo(): { commit: string | null; branch: string | null } {
  const commit = process.env.BENCH_GIT_COMMIT ?? null
  const branch = process.env.BENCH_GIT_BRANCH ?? null
  return { commit, branch }
}

async function appendToHistory(historyPath: string, entry: HistoryEntry): Promise<void> {
  const line = `${JSON.stringify(entry)}\n`
  await appendFile(historyPath, line, "utf8")
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const {
    gate,
    gateProfile,
    expectationsConfigProvided,
    expectationsConfigPath,
    expectationsModel,
    summaryJsonPath,
    summaryMdPath,
    suiteJsonlPaths,
  } = parseArgs(args)
  const rows =
    suiteJsonlPaths.length > 0
      ? await loadRowsFromSuiteFiles(suiteJsonlPaths)
      : await loadLatestRowsPerMode()

  if (rows.length === 0) {
    throw new Error("No benchmark result rows found")
  }

  const configPath = expectationsConfigPath ?? DEFAULT_EXPECTATIONS_CONFIG
  let expectationsModelResolved: string | null = null
  let gateThresholds = DEFAULT_GATE_THRESHOLDS

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
  let markdown = toMarkdown(summary)

  await mkdir(REPORTS_DIR, { recursive: true })
  const summaryJsonOutputPath = summaryJsonPath ?? join(REPORTS_DIR, "latest-summary.json")
  const summaryMdOutputPath = summaryMdPath ?? join(REPORTS_DIR, "latest-summary.md")
  const historyPath = join(RESULTS_DIR, "history.jsonl")

  await mkdir(dirname(summaryJsonOutputPath), { recursive: true })
  await mkdir(dirname(summaryMdOutputPath), { recursive: true })
  await mkdir(RESULTS_DIR, { recursive: true })

  const { commit, branch } = extractGitInfo()
  const historyEntry: HistoryEntry = {
    timestamp: summary.generatedAt,
    commit,
    branch,
    profile: gateProfile,
    modes: summary.modes,
    gate_passed: summary.gate.passed,
  }

  const history = await loadHistory(historyPath)
  const regressions = detectRegressions(summary, history)

  await appendToHistory(historyPath, historyEntry)
  console.log(`Appended history entry to ${historyPath}`)
  if (regressions.length > 0) {
    const regressionMarkdown = formatRegressionWarnings(regressions)
    markdown = `${markdown}\n\n${regressionMarkdown}`
  }

  await writeFile(summaryJsonOutputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8")
  await writeFile(summaryMdOutputPath, `${markdown}\n`, "utf8")

  console.log(`Wrote ${summaryJsonOutputPath}`)
  console.log(`Wrote ${summaryMdOutputPath}`)

  if (gate) {
    const status = summary.gate.passed ? "PASS" : "FAIL"
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

    if (summary.gate.checks.length > 0) {
      for (const check of summary.gate.checks) {
        const marker = check.passed ? "PASS" : "FAIL"
        console.log(
          ` - [${marker}] ${check.name}: value=${check.value.toFixed(2)} ${check.operator} threshold=${check.threshold.toFixed(2)}`,
        )
      }
    }
  }

  if (gate && !summary.gate.passed) {
    throw new Error(`Benchmark gate failed for profile ${gateProfile}`)
  }
}
