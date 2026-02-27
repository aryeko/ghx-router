import type { Collector } from "../contracts/collector.js"
import type { PromptResult } from "../contracts/provider.js"
import type { CustomMetric } from "../types/metrics.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"

/**
 * Collector that extracts wall-clock latency and per-segment durations from a prompt result.
 *
 * Emits `latency_wall_ms` plus one metric per timing segment named
 * `latency_<label>_ms`, all with the unit "ms".
 */
export class LatencyCollector implements Collector {
  /** Unique identifier for this collector. */
  readonly id = "latency"

  /**
   * Extract latency metrics from a completed prompt result.
   * @param result - The prompt result containing timing breakdown data.
   * @param _scenario - Unused; present to satisfy the Collector interface.
   * @param _mode - Unused; present to satisfy the Collector interface.
   * @param _trace - Unused; present to satisfy the Collector interface.
   * @returns An array of CustomMetric entries for wall time and each timing segment.
   */
  async collect(
    result: PromptResult,
    _scenario: BaseScenario,
    _mode: string,
    _trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]> {
    const { timing } = result.metrics
    const metrics: CustomMetric[] = [{ name: "latency_wall_ms", value: timing.wallMs, unit: "ms" }]

    for (const segment of timing.segments) {
      const durationMs = segment.endMs - segment.startMs
      metrics.push({
        name: `latency_${segment.label}_ms`,
        value: durationMs,
        unit: "ms",
      })
    }

    return metrics
  }
}
