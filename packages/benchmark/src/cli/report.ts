import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import type { BenchmarkMode, BenchmarkRow } from "../domain/types.js"
import { buildSummary, toMarkdown } from "../report/aggregate.js"

const RESULTS_DIR = join(process.cwd(), "results")
const REPORTS_DIR = join(process.cwd(), "reports")

export function parseArgs(args: string[]): { gate: boolean } {
  return {
    gate: args.includes("--gate")
  }
}

export function modeFromFilename(name: string): BenchmarkMode | null {
  if (name.includes("-agent_direct-suite.jsonl")) return "agent_direct"
  if (name.includes("-mcp-suite.jsonl")) return "mcp"
  if (name.includes("-ghx_router-suite.jsonl")) return "ghx_router"
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
  for (const file of latestByMode.values()) {
    const fileRows = await readRows(join(RESULTS_DIR, file))
    rows.push(...fileRows)
  }

  return rows
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const { gate } = parseArgs(args)
  const rows = await loadLatestRowsPerMode()

  if (rows.length === 0) {
    throw new Error("No benchmark result rows found")
  }

  const summary = buildSummary(rows)
  const markdown = toMarkdown(summary)

  await mkdir(REPORTS_DIR, { recursive: true })
  await writeFile(join(REPORTS_DIR, "latest-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8")
  await writeFile(join(REPORTS_DIR, "latest-summary.md"), `${markdown}\n`, "utf8")

  console.log(`Wrote reports/latest-summary.json`)
  console.log(`Wrote reports/latest-summary.md`)

  if (gate && !summary.gate.passed) {
    throw new Error("Benchmark gate failed")
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
