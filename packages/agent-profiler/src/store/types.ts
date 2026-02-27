/** Metadata record written alongside each profiling run for discovery and resumption. */
export interface RunManifest {
  /** Unique identifier assigned to this profiling run. */
  readonly runId: string
  /** ISO 8601 timestamp when the run started. */
  readonly startedAt: string
  /** ISO 8601 timestamp when the run completed, absent if the run is still in progress. */
  readonly completedAt?: string
  /** Ordered list of execution mode names profiled in this run. */
  readonly modes: readonly string[]
  /** Identifiers of all scenarios included in this run. */
  readonly scenarioIds: readonly string[]
  /** Number of repetitions executed per scenario per mode. */
  readonly repetitions: number
  /** Total number of profile rows written to the output JSONL file. */
  readonly totalRows: number
  /** Absolute path to the JSONL file containing the raw profile rows. */
  readonly outputJsonlPath: string
  /** Absolute path to the reports directory, if a report was generated. */
  readonly reportsDir?: string
  /** Arbitrary metadata attached by the caller for downstream tooling. */
  readonly metadata: Readonly<Record<string, unknown>>
}
