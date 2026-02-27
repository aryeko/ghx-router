import type { Collector } from "../contracts/collector.js"
import type { PromptResult } from "../contracts/provider.js"
import type { CustomMetric } from "../types/metrics.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"

/**
 * Collector that extracts tool call statistics from a prompt result.
 *
 * Emits total count, failed count, error rate, unique tool count, and
 * per-category counts (alphabetically sorted, named `tool_calls_category_<name>`).
 */
export class ToolCallCollector implements Collector {
  /** Unique identifier for this collector. */
  readonly id = "tool_calls"

  /**
   * Extract tool call metrics from a completed prompt result.
   * @param result - The prompt result containing tool call records.
   * @param _scenario - Unused; present to satisfy the Collector interface.
   * @param _mode - Unused; present to satisfy the Collector interface.
   * @param _trace - Unused; present to satisfy the Collector interface.
   * @returns An array of CustomMetric entries for tool call aggregates and per-category counts.
   */
  async collect(
    result: PromptResult,
    _scenario: BaseScenario,
    _mode: string,
    _trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]> {
    const { toolCalls } = result.metrics

    const total = toolCalls.length
    const failed = toolCalls.filter((tc) => !tc.success).length
    const errorRate = total === 0 ? 0 : failed / total

    const uniqueNames = new Set(toolCalls.map((tc) => tc.name))

    const categoryCounts = new Map<string, number>()
    for (const tc of toolCalls) {
      const prev = categoryCounts.get(tc.category) ?? 0
      categoryCounts.set(tc.category, prev + 1)
    }

    const metrics: CustomMetric[] = [
      { name: "tool_calls_total", value: total, unit: "count" },
      { name: "tool_calls_failed", value: failed, unit: "count" },
      { name: "tool_calls_error_rate", value: errorRate, unit: "ratio" },
      { name: "tool_calls_unique", value: uniqueNames.size, unit: "count" },
    ]

    const sortedCategories = [...categoryCounts.entries()].sort(([a], [b]) => a.localeCompare(b))
    for (const [category, count] of sortedCategories) {
      metrics.push({
        name: `tool_calls_category_${category}`,
        value: count,
        unit: "count",
      })
    }

    return metrics
  }
}
