import type { CustomMetric } from "../types/metrics.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"
import type { PromptResult } from "./provider.js"

/** Collect custom metrics from a completed prompt result and optional session trace. */
export interface Collector {
  /** Unique identifier for this collector implementation. */
  readonly id: string
  /**
   * Extract custom metrics from a completed prompt execution.
   * @param result - The raw prompt result containing metrics from the provider.
   * @param scenario - The scenario that was executed.
   * @param mode - The execution mode name for this iteration.
   * @param trace - The full session trace, or null if export was disabled.
   * @returns An array of named custom metrics to be stored in the profile row extensions.
   */
  collect(
    result: PromptResult,
    scenario: BaseScenario,
    mode: string,
    trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]>
}
