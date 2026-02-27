export interface RunManifest {
  readonly runId: string
  readonly startedAt: string
  readonly completedAt?: string
  readonly modes: readonly string[]
  readonly scenarioIds: readonly string[]
  readonly repetitions: number
  readonly totalRows: number
  readonly outputJsonlPath: string
  readonly reportsDir?: string
  readonly metadata: Readonly<Record<string, unknown>>
}
