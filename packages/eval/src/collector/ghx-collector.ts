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

/**
 * Collector that classifies tool calls from an agent session into six
 * categories and emits them as custom metrics on each ProfileRow.
 *
 * | Metric              | Counts                              |
 * |---------------------|-------------------------------------|
 * | `capabilities_used` | ghx capability invocations          |
 * | `mcp_tools_invoked` | MCP server tool calls               |
 * | `gh_cli_commands`   | direct `gh` tool calls (bash-wrapped `gh` commands count as `bash_commands`) |
 * | `bash_commands`     | General bash/shell executions       |
 * | `file_ops`          | File read / write / edit operations |
 * | `other_tools`       | Uncategorized tool calls            |
 *
 * Implements `Collector` from `@ghx-dev/agent-profiler`.
 *
 * @example
 * ```typescript
 * import { GhxCollector } from "@ghx-dev/eval"
 *
 * const collector = new GhxCollector()
 * // Pass to runProfileSuite: collectors: [collector]
 * ```
 */
export class GhxCollector implements Collector {
  readonly id = "ghx"

  async collect(
    result: PromptResult,
    _scenario: BaseScenario,
    _mode: string,
    trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]> {
    const counts: Record<ToolCategory, number> = {
      ghx: 0,
      mcp: 0,
      gh_cli: 0,
      bash: 0,
      file_ops: 0,
      other: 0,
    }

    if (trace !== null) {
      // Prefer trace events: they carry input, enabling gh_cli detection for bash tool calls
      for (const event of trace.events) {
        if (event.type === "tool_call") {
          const toolEvent = event as { name: string; input: unknown }
          const category = classifyToolCall(toolEvent.name, toolEvent.input)
          counts[category]++
        }
      }
    } else {
      // Fall back to PromptResult.metrics.toolCalls (no input available, gh_cli always 0)
      for (const tc of result.metrics.toolCalls) {
        const category = classifyToolCall(tc.name)
        counts[category]++
      }
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
