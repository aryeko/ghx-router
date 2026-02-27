import type { Collector } from "../contracts/collector.js"
import type { PromptResult } from "../contracts/provider.js"
import type { CustomMetric } from "../types/metrics.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"

/**
 * Collector that extracts USD cost breakdown from a prompt result.
 *
 * Emits metrics for total, input, output, and reasoning costs, all with the unit "usd".
 */
export class CostCollector implements Collector {
  /** Unique identifier for this collector. */
  readonly id = "cost"

  /**
   * Extract cost metrics from a completed prompt result.
   * @param result - The prompt result containing cost breakdown data.
   * @param _scenario - Unused; present to satisfy the Collector interface.
   * @param _mode - Unused; present to satisfy the Collector interface.
   * @param _trace - Unused; present to satisfy the Collector interface.
   * @returns An array of CustomMetric entries for each cost category.
   */
  async collect(
    result: PromptResult,
    _scenario: BaseScenario,
    _mode: string,
    _trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]> {
    const { cost } = result.metrics
    return [
      { name: "cost_total_usd", value: cost.totalUsd, unit: "usd" },
      { name: "cost_input_usd", value: cost.inputUsd, unit: "usd" },
      { name: "cost_output_usd", value: cost.outputUsd, unit: "usd" },
      { name: "cost_reasoning_usd", value: cost.reasoningUsd, unit: "usd" },
    ]
  }
}
