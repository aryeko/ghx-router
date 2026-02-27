import { compareGroups } from "@profiler/stats/comparison.js"
import type { ProfileRow } from "@profiler/types/profile-row.js"

function heatBar(reductionPct: number): string {
  const clamped = Math.max(0, Math.min(100, Math.abs(reductionPct)))
  const count = Math.round(clamped / 5)
  return "#".repeat(count)
}

export function generateComparisonPage(rows: readonly ProfileRow[]): string {
  const modes = [...new Set(rows.map((r) => r.mode))]

  if (modes.length < 2) {
    return ["# Mode Comparison", "", "Single mode -- no comparison available."].join("\n")
  }

  const lines: string[] = ["# Mode Comparison", ""]

  for (let i = 0; i < modes.length; i++) {
    for (let j = i + 1; j < modes.length; j++) {
      const modeA = modes[i] ?? ""
      const modeB = modes[j] ?? ""
      const aValues = rows.filter((r) => r.mode === modeA).map((r) => r.timing.wallMs)
      const bValues = rows.filter((r) => r.mode === modeB).map((r) => r.timing.wallMs)

      if (aValues.length === 0 || bValues.length === 0) continue

      const result = compareGroups(modeA, aValues, modeB, bValues, "wallMs", {
        permutationOptions: { permutations: 1000, seed: 42 },
        bootstrapOptions: { resamples: 1000, seed: 42 },
      })

      const ci0 = result.ci95[0] ?? 0
      const ci1 = result.ci95[1] ?? 0

      lines.push(
        `## ${modeA} vs ${modeB}`,
        "",
        "| Metric | Value |",
        "| --- | --- |",
        `| Reduction | ${result.reductionPct.toFixed(1)}% |`,
        `| 95% CI | [${ci0.toFixed(1)}%, ${ci1.toFixed(1)}%] |`,
        `| Effect Size | ${result.effectSize.toFixed(3)} (${result.effectMagnitude}) |`,
        `| p-value | ${result.pValue.toFixed(4)} |`,
        "",
        "### Reduction Heatmap",
        "",
        `\`${heatBar(result.reductionPct)}\` ${result.reductionPct.toFixed(1)}%`,
        "",
      )
    }
  }

  return lines.join("\n")
}
