import { mkdir, readdir, readFile, appendFile } from "node:fs/promises"
import { join } from "node:path"
import { randomUUID } from "node:crypto"

type BenchmarkMode = "agent_direct" | "mcp" | "ghx_router"

type Scenario = {
  id: string
  name: string
  task: string
  input: Record<string, unknown>
}

type ResultRow = {
  timestamp: string
  mode: BenchmarkMode
  scenario_id: string
  run_id: string
  success: boolean
  latency_ms: number
  tokens_total: number
  tool_calls: number
  api_calls: number
  retry_count: number
  output_valid: boolean
  notes?: string
}

const ROOT = process.cwd()
const SCENARIOS_DIR = join(ROOT, "bench", "scenarios")
const RESULTS_DIR = join(ROOT, "bench", "results")

const MODE = (process.argv[2] ?? "ghx_router") as BenchmarkMode
const RUNS_PER_SCENARIO = Number(process.argv[3] ?? "1")

async function loadScenarios(): Promise<Scenario[]> {
  const files = await readdir(SCENARIOS_DIR)
  const scenarioFiles = files.filter((file) => file.endsWith(".json"))

  const scenarios = await Promise.all(
    scenarioFiles.map(async (file) => {
      const raw = await readFile(join(SCENARIOS_DIR, file), "utf8")
      return JSON.parse(raw) as Scenario
    })
  )

  return scenarios
}

async function ensureDirs(): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true })
}

async function runScenario(scenario: Scenario, mode: BenchmarkMode): Promise<ResultRow> {
  const now = new Date().toISOString()

  return {
    timestamp: now,
    mode,
    scenario_id: scenario.id,
    run_id: randomUUID(),
    success: false,
    latency_ms: 0,
    tokens_total: 0,
    tool_calls: 0,
    api_calls: 0,
    retry_count: 0,
    output_valid: false,
    notes: "stub-runner: implement real task execution"
  }
}

async function main(): Promise<void> {
  if (!["agent_direct", "mcp", "ghx_router"].includes(MODE)) {
    throw new Error(`Unsupported mode: ${MODE}`)
  }

  if (!Number.isInteger(RUNS_PER_SCENARIO) || RUNS_PER_SCENARIO < 1) {
    throw new Error(`Invalid runs per scenario: ${RUNS_PER_SCENARIO}`)
  }

  await ensureDirs()
  const scenarios = await loadScenarios()

  const outFile = join(
    RESULTS_DIR,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${MODE}.jsonl`
  )

  for (const scenario of scenarios) {
    for (let i = 0; i < RUNS_PER_SCENARIO; i += 1) {
      const row = await runScenario(scenario, MODE)
      await appendFile(outFile, `${JSON.stringify(row)}\n`, "utf8")
    }
  }

  console.log(`Wrote benchmark results: ${outFile}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
