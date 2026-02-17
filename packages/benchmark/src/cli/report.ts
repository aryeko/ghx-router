import { appendFile, mkdir, readdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { z } from "zod"
import type { BenchmarkMode, BenchmarkRow, GateProfile, HistoryEntry } from "../domain/types.js"
import { buildSummary, DEFAULT_GATE_V2_THRESHOLDS, toMarkdown } from "../report/aggregate.js"
import {
  expectationsConfigExists,
  inferModelSignatureFromRows,
  loadExpectationsConfig,
  resolveGateThresholdsForModel,
  resolveModelForExpectations,
} from "../report/expectations.js"
import { detectRegressions, formatRegressionWarnings, loadHistory } from "../report/regression.js"
import { readJsonlFile } from "../utils/jsonl.js"
import { runIfDirectEntry } from "./entry.js"
import { parseMultiFlagValues } from "./flag-utils.js"

const benchmarkRowSchema = z.object({
  timestamp: z.string(),
  run_id: z.string(),
  mode: z.enum(["agent_direct", "mcp", "ghx"]),
  scenario_id: z.string(),
  scenario_set: z.string().nullable(),
  iteration: z.number(),
  session_id: z.string().nullable(),
  success: z.boolean(),
  output_valid: z.boolean(),
  latency_ms_wall: z.number(),
  sdk_latency_ms: z.number().nullable(),
  timing_breakdown: z
    .object({
      assistant_total_ms: z.number(),
      assistant_pre_reasoning_ms: z.number(),
      assistant_reasoning_ms: z.number(),
      assistant_between_reasoning_and_tool_ms: z.number(),
      assistant_post_tool_ms: z.number(),
      tool_total_ms: z.number(),
      tool_bash_ms: z.number(),
      tool_structured_output_ms: z.number(),
      observed_assistant_turns: z.number(),
    })
    .optional(),
  tokens: z.object({
    input: z.number(),
    output: z.number(),
    reasoning: z.number(),
    cache_read: z.number(),
    cache_write: z.number(),
    total: z.number(),
  }),
  cost: z.number(),
  tool_calls: z.number(),
  api_calls: z.number(),
  internal_retry_count: z.number(),
  external_retry_count: z.number(),
  model: z.object({
    provider_id: z.string(),
    model_id: z.string(),
    mode: z.string().nullable(),
  }),
  git: z.object({
    repo: z.string().nullable(),
    commit: z.string().nullable(),
  }),
  error: z
    .object({
      type: z.string(),
      message: z.string(),
    })
    .nullable(),
})

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
  summaryJsonPath: string | null
  summaryMdPath: string | null
  suiteJsonlPaths: string[]
} {
  const parseStringFlag = (
    flagName: "expectations-config" | "expectations-model" | "summary-json" | "summary-md",
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
  const summaryJson = parseStringFlag("summary-json")
  const summaryMd = parseStringFlag("summary-md")

  const suiteJsonlPaths = parseMultiFlagValues(args, "--suite-jsonl")

  return {
    gate: args.includes("--gate"),
    gateProfile: parseGateProfile(args),
    expectationsConfigProvided: expectationsConfig.provided,
    expectationsConfigPath: expectationsConfig.value,
    expectationsModel: expectationsModel.value,
    summaryJsonPath: summaryJson.value,
    summaryMdPath: summaryMd.value,
    suiteJsonlPaths,
  }
}

export function modeFromFilename(name: string): BenchmarkMode | null {
  if (name.includes("-agent_direct-suite.jsonl")) return "agent_direct"
  if (name.includes("-mcp-suite.jsonl")) return "mcp"
  if (name.includes("-ghx-suite.jsonl")) return "ghx"
  return null
}

export async function readRows(filePath: string): Promise<BenchmarkRow[]> {
  return readJsonlFile(filePath, benchmarkRowSchema) as Promise<BenchmarkRow[]>
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

export async function loadRowsFromSuiteFiles(paths: string[]): Promise<BenchmarkRow[]> {
  const rows: BenchmarkRow[] = []
  const rowsByMode = new Map<BenchmarkMode, BenchmarkRow[]>()

  for (const path of paths) {
    const fileRows = await readRows(path)
    rows.push(...fileRows)
    for (const row of fileRows) {
      const modeRows = rowsByMode.get(row.mode) ?? []
      modeRows.push(row)
      rowsByMode.set(row.mode, modeRows)
    }
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

function extractGitInfo(): { commit: string | null; branch: string | null } {
  const commit = process.env.GIT_COMMIT ?? null
  const branch = process.env.GIT_BRANCH ?? null
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
    gate_passed: summary.gateV2.passed,
  }

  await appendToHistory(historyPath, historyEntry)
  console.log(`Appended history entry to ${historyPath}`)

  const history = await loadHistory(historyPath)
  const regressions = detectRegressions(summary, history)
  if (regressions.length > 0) {
    const regressionMarkdown = formatRegressionWarnings(regressions)
    markdown = `${markdown}\n\n${regressionMarkdown}`
  }

  await writeFile(summaryJsonOutputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8")
  await writeFile(summaryMdOutputPath, `${markdown}\n`, "utf8")

  console.log(`Wrote ${summaryJsonOutputPath}`)
  console.log(`Wrote ${summaryMdOutputPath}`)

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

runIfDirectEntry(import.meta.url, main)
