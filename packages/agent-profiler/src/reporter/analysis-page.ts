import type { AnalysisFinding, SessionAnalysisBundle } from "@profiler/types/trace.js"

function renderFinding(key: string, finding: AnalysisFinding): readonly string[] {
  switch (finding.type) {
    case "number":
      return [`- **${key}**: ${finding.value} ${finding.unit}`]
    case "string":
      return [`- **${key}**: ${finding.value}`]
    case "ratio":
      return [`- **${key}**: ${(finding.value * 100).toFixed(1)}% (${finding.label})`]
    case "list":
      return [`- **${key}**:`, ...finding.values.map((v) => `  - ${v}`)]
    case "table":
      return [
        `- **${key}**:`,
        "",
        `| ${finding.headers.join(" | ")} |`,
        `| ${finding.headers.map(() => "---").join(" | ")} |`,
        ...finding.rows.map((row) => `| ${row.join(" | ")} |`),
        "",
      ]
  }
}

export function generateAnalysisPage(
  _rows: readonly unknown[],
  analysisResults: readonly SessionAnalysisBundle[],
): string {
  if (analysisResults.length === 0) {
    return ["# Session Analysis", "", "No session analysis data available."].join("\n")
  }

  const lines: string[] = ["# Session Analysis", ""]

  for (const bundle of analysisResults) {
    lines.push(
      `## Session: ${bundle.sessionId}`,
      "",
      `- **Scenario**: ${bundle.scenarioId}`,
      `- **Mode**: ${bundle.mode}`,
      `- **Model**: ${bundle.model}`,
      "",
    )

    const resultEntries = Object.entries(bundle.results)
    for (const [analyzerName, result] of resultEntries) {
      lines.push(`### ${analyzerName}`, "")
      lines.push(`> ${result.summary}`, "")

      const findingEntries = Object.entries(result.findings)
      for (const [key, finding] of findingEntries) {
        lines.push(...renderFinding(key, finding))
      }
      lines.push("")
    }
  }

  return lines.join("\n")
}
