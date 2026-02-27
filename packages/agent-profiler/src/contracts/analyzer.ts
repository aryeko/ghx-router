import type { BaseScenario } from "../types/scenario.js"
import type { AnalysisResult, SessionTrace } from "../types/trace.js"

/** Perform structured analysis on a session trace to produce findings. */
export interface Analyzer {
  /** Unique name identifying this analyzer (used as key in analysis bundles). */
  readonly name: string
  /**
   * Analyze a session trace and return structured findings.
   * @param trace - The full event trace for the session to analyze.
   * @param scenario - The scenario that was executed.
   * @param mode - The execution mode name for this session.
   * @returns Structured analysis result with named findings and a summary string.
   */
  analyze(trace: SessionTrace, scenario: BaseScenario, mode: string): Promise<AnalysisResult>
}
