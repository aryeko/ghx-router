import { readdir, stat } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import type { BenchmarkRow } from "../domain/types.js"
import { readJsonlFile } from "../util/jsonl.js"

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

  return files
    .filter((f) => f.startsWith(benchRunTs) && f.endsWith("-suite.jsonl"))
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
