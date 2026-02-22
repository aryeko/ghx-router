import type { BenchmarkMode } from "./types.js"

export type ProgressEvent = {
  timestamp: string
  type: "suite_start" | "suite_end" | "mode_start" | "mode_end" | "scenario_start" | "scenario_end"
  mode?: BenchmarkMode
  scenarioId?: string
  iteration?: number
  durationMs?: number
  status?: "success" | "failure"
  message?: string
}

export function emitProgress(event: ProgressEvent): void {
  console.log(JSON.stringify(event))
}
