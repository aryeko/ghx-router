import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import type { BenchmarkMode, BenchmarkRow } from "../domain/types.js"
import { buildSummary, toMarkdown } from "../report/aggregate.js"
import type { GateProfile } from "../report/aggregate.js"

const RESULTS_DIR = join(process.cwd(), "results")
const REPORTS_DIR = join(process.cwd(), "reports")

function parseGateProfile(args: string[]): GateProfile {
  const inline = args.find((arg) => arg.startsWith("--gate-profile="))
  if (inline) {
    const value = inline.slice("--gate-profile=".length)
    if (value === "pr_fast" || value === "release_strict") {
      return value
    }
    throw new Error("Unknown gate profile. Expected pr_fast or release_strict")
  }

  const index = args.findIndex((arg) => arg === "--gate-profile")
  if (index === -1) {
    return "pr_fast"
  }

  const value = args[index + 1]
  if (value === "pr_fast" || value === "release_strict") {
    return value
  }

  throw new Error("Unknown gate profile. Expected pr_fast or release_strict")
}

export function parseArgs(args: string[]): { gate: boolean; gateProfile: GateProfile } {
  return {
    gate: args.includes("--gate"),
    gateProfile: parseGateProfile(args)
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
  return Array.from(new Set(rows.map((row) => row.scenario_id))).sort().join(",")
}

function uniqueModelSignature(rows: BenchmarkRow[]): string {
  return Array.from(
    new Set(rows.map((row) => `${row.model.provider_id}/${row.model.model_id}/${row.model.mode ?? "<null>"}`)),
  )
    .sort()
    .join(",")
}

function uniqueGitCommits(rows: BenchmarkRow[]): string {
  return Array.from(new Set(rows.map((row) => row.git.commit ?? "<null>"))).sort().join(",")
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
  const { gate, gateProfile } = parseArgs(args)
  const rows = await loadLatestRowsPerMode()

  if (rows.length === 0) {
    throw new Error("No benchmark result rows found")
  }

  const summary = buildSummary(rows, undefined, gateProfile)
  const markdown = toMarkdown(summary)

  await mkdir(REPORTS_DIR, { recursive: true })
  await writeFile(join(REPORTS_DIR, "latest-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8")
  await writeFile(join(REPORTS_DIR, "latest-summary.md"), `${markdown}\n`, "utf8")

  console.log(`Wrote reports/latest-summary.json`)
  console.log(`Wrote reports/latest-summary.md`)

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
