import type { ProfileRow } from "@profiler/types/profile-row.js"

const HEADERS = [
  "run_id",
  "scenario_id",
  "mode",
  "model",
  "iteration",
  "success",
  "timing_wall_ms",
  "tokens_input",
  "tokens_output",
  "tokens_reasoning",
  "tokens_cache_read",
  "tokens_cache_write",
  "tokens_total",
  "tokens_active",
  "tool_calls_total",
  "tool_calls_failed",
  "tool_calls_error_rate",
  "cost_total_usd",
  "cost_input_usd",
  "cost_output_usd",
  "cost_reasoning_usd",
  "checkpoints_passed",
  "checkpoints_total",
  "output_valid",
  "provider",
  "session_id",
  "agent_turns",
  "completion_reason",
] as const

function escapeCsvField(value: string | number | boolean): string {
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowToCsv(row: ProfileRow): string {
  const fields: readonly (string | number | boolean)[] = [
    row.runId,
    row.scenarioId,
    row.mode,
    row.model,
    row.iteration,
    row.success,
    row.timing.wallMs,
    row.tokens.input,
    row.tokens.output,
    row.tokens.reasoning,
    row.tokens.cacheRead,
    row.tokens.cacheWrite,
    row.tokens.total,
    row.tokens.active,
    row.toolCalls.total,
    row.toolCalls.failed,
    row.toolCalls.errorRate,
    row.cost.totalUsd,
    row.cost.inputUsd,
    row.cost.outputUsd,
    row.cost.reasoningUsd,
    row.checkpointsPassed,
    row.checkpointsTotal,
    row.outputValid,
    row.provider,
    row.sessionId,
    row.agentTurns,
    row.completionReason,
  ]
  return fields.map(escapeCsvField).join(",")
}

export function exportCsv(rows: readonly ProfileRow[]): string {
  const headerLine = HEADERS.join(",")
  const dataLines = rows.map(rowToCsv)
  return [headerLine, ...dataLines].join("\n")
}
