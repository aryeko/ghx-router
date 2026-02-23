import type { IterData } from "./iter-reader.js"
import { readRunDir } from "./iter-reader.js"

export type IterMetrics = {
  toolCallCount: number
  totalTokens: number | null
  reasoningBlocks: number
  bashCommandCount: number
}

export type IterPair = {
  scenarioId: string
  iteration: number
  ghx: IterData | null
  agentDirect: IterData | null
  ghxMetrics: IterMetrics | null
  adMetrics: IterMetrics | null
}

export type ScenarioPairSummary = {
  scenarioId: string
  iterCount: number
  avgGhxToolCalls: number | null
  avgAdToolCalls: number | null
  avgGhxTokens: number | null
  avgAdTokens: number | null
}

export type IterReport = {
  generatedAt: string
  ghxRunDir: string
  adRunDir: string
  pairs: IterPair[]
  scenarioSummaries: ScenarioPairSummary[]
}

export function toMetrics(iter: IterData): IterMetrics {
  return {
    toolCallCount: iter.session?.toolCallCount ?? 0,
    totalTokens: iter.session?.tokens?.total ?? null,
    reasoningBlocks: iter.session?.reasoningBlocks ?? 0,
    bashCommandCount: iter.session?.toolCallCommands.filter((c) => c.length > 0).length ?? 0,
  }
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function buildScenarioSummaries(pairs: IterPair[]): ScenarioPairSummary[] {
  const byScenario = new Map<string, IterPair[]>()
  for (const pair of pairs) {
    const existing = byScenario.get(pair.scenarioId) ?? []
    byScenario.set(pair.scenarioId, [...existing, pair])
  }

  const summaries: ScenarioPairSummary[] = []
  for (const [scenarioId, scenarioPairs] of byScenario) {
    const ghxToolCalls = scenarioPairs
      .map((p) => p.ghxMetrics?.toolCallCount)
      .filter((v): v is number => v !== undefined && v !== null)
    const adToolCalls = scenarioPairs
      .map((p) => p.adMetrics?.toolCallCount)
      .filter((v): v is number => v !== undefined && v !== null)
    const ghxTokens = scenarioPairs
      .map((p) => p.ghxMetrics?.totalTokens)
      .filter((v): v is number => v !== null && v !== undefined)
    const adTokens = scenarioPairs
      .map((p) => p.adMetrics?.totalTokens)
      .filter((v): v is number => v !== null && v !== undefined)

    summaries.push({
      scenarioId,
      iterCount: scenarioPairs.length,
      avgGhxToolCalls: avg(ghxToolCalls),
      avgAdToolCalls: avg(adToolCalls),
      avgGhxTokens: avg(ghxTokens),
      avgAdTokens: avg(adTokens),
    })
  }

  return summaries.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId))
}

export async function buildIterReport(ghxRunDir: string, adRunDir: string): Promise<IterReport> {
  const [ghxData, adData] = await Promise.all([readRunDir(ghxRunDir), readRunDir(adRunDir)])

  const keys = new Set<string>()
  for (const item of ghxData) {
    keys.add(`${item.scenarioId}::${item.iteration}`)
  }
  for (const item of adData) {
    keys.add(`${item.scenarioId}::${item.iteration}`)
  }

  const ghxMap = new Map<string, IterData>()
  for (const item of ghxData) {
    ghxMap.set(`${item.scenarioId}::${item.iteration}`, item)
  }
  const adMap = new Map<string, IterData>()
  for (const item of adData) {
    adMap.set(`${item.scenarioId}::${item.iteration}`, item)
  }

  const pairs: IterPair[] = []
  for (const key of keys) {
    const [scenarioId, iterStr] = key.split("::")
    if (!scenarioId || !iterStr) continue
    const iteration = Number(iterStr)
    const ghx = ghxMap.get(key) ?? null
    const agentDirect = adMap.get(key) ?? null

    pairs.push({
      scenarioId,
      iteration,
      ghx,
      agentDirect,
      ghxMetrics: ghx !== null ? toMetrics(ghx) : null,
      adMetrics: agentDirect !== null ? toMetrics(agentDirect) : null,
    })
  }

  pairs.sort((a, b) => {
    const cmp = a.scenarioId.localeCompare(b.scenarioId)
    return cmp !== 0 ? cmp : a.iteration - b.iteration
  })

  const scenarioSummaries = buildScenarioSummaries(pairs)

  return {
    generatedAt: new Date().toISOString(),
    ghxRunDir,
    adRunDir,
    pairs,
    scenarioSummaries,
  }
}

function fmtNum(value: number | null | undefined): string {
  if (value === null || value === undefined) return "n/a"
  return String(Math.round(value))
}

function fmtDelta(ghxVal: number | null | undefined, adVal: number | null | undefined): string {
  if (ghxVal === null || ghxVal === undefined || adVal === null || adVal === undefined) {
    return "n/a"
  }
  const delta = ghxVal - adVal
  const pct = adVal !== 0 ? Math.round((delta / adVal) * 100) : null
  const sign = delta >= 0 ? "+" : ""
  const pctStr = pct !== null ? ` (${sign}${pct}%)` : ""
  return `${sign}${Math.round(delta)}${pctStr}`
}

function fmtAvg(value: number | null): string {
  if (value === null) return "n/a"
  return value.toFixed(1)
}

export function formatIterReport(report: IterReport): string {
  const lines: string[] = []

  lines.push("# Benchmark Iteration Report")
  lines.push("")
  lines.push(`Generated: ${report.generatedAt}`)
  lines.push("")

  lines.push("## Summary Table")
  lines.push("")
  lines.push(
    "| Scenario | Iters | ghx tool calls | ad tool calls | Delta tool calls | ghx tokens | ad tokens | Delta tokens |",
  )
  lines.push(
    "|----------|-------|----------------|---------------|-----------------|------------|-----------|-------------|",
  )
  for (const s of report.scenarioSummaries) {
    const ghxTC = fmtAvg(s.avgGhxToolCalls)
    const adTC = fmtAvg(s.avgAdToolCalls)
    const deltaTC = fmtDelta(s.avgGhxToolCalls, s.avgAdToolCalls)
    const ghxTok = fmtAvg(s.avgGhxTokens)
    const adTok = fmtAvg(s.avgAdTokens)
    const deltaTok = fmtDelta(s.avgGhxTokens, s.avgAdTokens)
    lines.push(
      `| ${s.scenarioId} | ${s.iterCount} | ${ghxTC} | ${adTC} | ${deltaTC} | ${ghxTok} | ${adTok} | ${deltaTok} |`,
    )
  }
  lines.push("")

  const byScenario = new Map<string, IterPair[]>()
  for (const pair of report.pairs) {
    const existing = byScenario.get(pair.scenarioId) ?? []
    byScenario.set(pair.scenarioId, [...existing, pair])
  }

  const scenarioIds = [...byScenario.keys()].sort()
  for (const scenarioId of scenarioIds) {
    lines.push(`## Scenario: ${scenarioId}`)
    lines.push("")

    const scenarioPairs = byScenario.get(scenarioId) ?? []
    for (const pair of scenarioPairs) {
      lines.push(`### Iteration ${pair.iteration}`)
      lines.push("")

      const ghxTC = fmtNum(pair.ghxMetrics?.toolCallCount)
      const adTC = fmtNum(pair.adMetrics?.toolCallCount)
      const deltaTC = fmtDelta(pair.ghxMetrics?.toolCallCount, pair.adMetrics?.toolCallCount)

      const ghxTok = fmtNum(pair.ghxMetrics?.totalTokens)
      const adTok = fmtNum(pair.adMetrics?.totalTokens)
      const deltaTok = fmtDelta(pair.ghxMetrics?.totalTokens, pair.adMetrics?.totalTokens)

      const ghxRB = fmtNum(pair.ghxMetrics?.reasoningBlocks)
      const adRB = fmtNum(pair.adMetrics?.reasoningBlocks)
      const deltaRB = fmtDelta(pair.ghxMetrics?.reasoningBlocks, pair.adMetrics?.reasoningBlocks)

      const ghxBC = fmtNum(pair.ghxMetrics?.bashCommandCount)
      const adBC = fmtNum(pair.adMetrics?.bashCommandCount)
      const deltaBc = fmtDelta(pair.ghxMetrics?.bashCommandCount, pair.adMetrics?.bashCommandCount)

      lines.push("| Metric           | ghx   | agent_direct | delta    |")
      lines.push("|------------------|-------|--------------|----------|")
      lines.push(`| Tool calls       | ${ghxTC} | ${adTC} | ${deltaTC} |`)
      lines.push(`| Tokens (total)   | ${ghxTok} | ${adTok} | ${deltaTok} |`)
      lines.push(`| Reasoning blocks | ${ghxRB} | ${adRB} | ${deltaRB} |`)
      lines.push(`| Bash commands    | ${ghxBC} | ${adBC} | ${deltaBc} |`)
      lines.push("")

      if (pair.ghx?.ghxLogs?.capabilities && pair.ghx.ghxLogs.capabilities.length > 0) {
        lines.push("**ghx capabilities invoked:**")
        for (const cap of pair.ghx.ghxLogs.capabilities) {
          const route = cap.route ?? "unknown"
          const status = cap.ok ? "ok" : "fail"
          lines.push(`- \`${cap.capability_id}\` via ${route} (${status})`)
        }
        lines.push("")
      }

      const adCommands =
        pair.agentDirect?.session?.toolCallCommands.filter((c) => c.length > 0) ?? []
      if (adCommands.length > 0) {
        lines.push("**agent_direct bash commands:**")
        for (const cmd of adCommands) {
          lines.push(`- \`${cmd}\``)
        }
        lines.push("")
      }
    }
  }

  return lines.join("\n")
}
