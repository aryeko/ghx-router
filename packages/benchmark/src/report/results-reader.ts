import { readdir, stat } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import type { BenchmarkRow } from "../domain/types.js"
import { readJsonlFile } from "../util/jsonl.js"

/** Convert sanitized bench timestamp (e.g. "2026-02-23T22-54-45-263Z") to ms since epoch. */
function parseBenchRunTs(ts: string): number | null {
  // Format: YYYY-MM-DDTHH-mm-ss-mmmZ  (24 chars)
  if (ts.length < 24 || !ts.endsWith("Z")) return null
  const iso = ts.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z")
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : ms
}

export async function findRepoRoot(startDir: string): Promise<string | null> {
  let current = startDir
  while (true) {
    const candidate = join(current, "packages", "benchmark", "results")
    try {
      const s = await stat(candidate)
      if (s.isDirectory()) return current
    } catch {
      // not found at this level
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return null
}

export async function findResultsJsonl(runDir: string): Promise<string[]> {
  const benchRunTs = basename(runDir)
  if (benchRunTs.length === 0) return []

  const repoRoot = await findRepoRoot(runDir)
  if (repoRoot === null) return []

  const resultsDir = join(repoRoot, "packages", "benchmark", "results")
  let files: string[]
  try {
    files = await readdir(resultsDir)
  } catch {
    return []
  }

  // Exact prefix match (new runs where benchRunTs is reused for results file name)
  const exact = files.filter((f) => f.startsWith(benchRunTs) && f.endsWith("-suite.jsonl"))
  if (exact.length > 0) return exact.map((f) => join(resultsDir, f))

  // Fuzzy match: parse benchRunTs as a date and find results files within 30 seconds
  const runTime = parseBenchRunTs(benchRunTs)
  if (runTime === null) return []

  return files
    .filter((f) => {
      if (!f.endsWith("-suite.jsonl")) return false
      const fileTs = f.slice(0, benchRunTs.length)
      const fileTime = parseBenchRunTs(fileTs)
      if (fileTime === null) return false
      return Math.abs(fileTime - runTime) <= 30_000
    })
    .map((f) => join(resultsDir, f))
}

export async function loadResultsMap(runDir: string): Promise<Map<string, BenchmarkRow>> {
  const jsonlPaths = await findResultsJsonl(runDir)
  const map = new Map<string, BenchmarkRow>()

  for (const filePath of jsonlPaths) {
    let rows: BenchmarkRow[]
    try {
      rows = await readJsonlFile<BenchmarkRow>(filePath)
    } catch {
      continue
    }
    for (const row of rows) {
      map.set(`${row.scenario_id}::${row.iteration}`, row)
    }
  }

  return map
}
