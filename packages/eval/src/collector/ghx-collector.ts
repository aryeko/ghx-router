import type {
  BaseScenario,
  Collector,
  CustomMetric,
  PromptResult,
  SessionTrace,
} from "@ghx-dev/agent-profiler"
import { classifyToolCall, type ToolCategory } from "./tool-classifier.js"

const CATEGORY_METRIC_NAMES: Readonly<Record<ToolCategory, string>> = {
  ghx: "ghx.capabilities_used",
  mcp: "ghx.mcp_tools_invoked",
  gh_cli: "ghx.gh_cli_commands",
  bash: "ghx.bash_commands",
  file_ops: "ghx.file_ops",
  other: "ghx.other_tools",
}

export class GhxCollector implements Collector {
  readonly id = "ghx"

  async collect(
    result: PromptResult,
    _scenario: BaseScenario,
    _mode: string,
    _trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]> {
    const counts: Record<ToolCategory, number> = {
      ghx: 0,
      mcp: 0,
      gh_cli: 0,
      bash: 0,
      file_ops: 0,
      other: 0,
    }

    for (const tc of result.metrics.toolCalls) {
      const category = classifyToolCall(tc.name)
      counts[category]++
    }

    const metrics: CustomMetric[] = []
    for (const [category, count] of Object.entries(counts) as [ToolCategory, number][]) {
      metrics.push({
        name: CATEGORY_METRIC_NAMES[category],
        value: count,
        unit: "count",
      })
    }

    return metrics
  }
}
