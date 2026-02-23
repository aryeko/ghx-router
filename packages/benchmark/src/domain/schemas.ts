import { z } from "zod"

export const benchmarkRowSchema = z.object({
  timestamp: z.string(),
  run_id: z.string(),
  mode: z.enum(["agent_direct", "mcp", "ghx"]),
  scenario_id: z.string(),
  scenario_set: z.string().nullable(),
  iteration: z.number(),
  session_id: z.string().nullable(),
  success: z.boolean(),
  output_valid: z.boolean(),
  latency_ms_wall: z.number(),
  sdk_latency_ms: z.number().nullable(),
  timing_breakdown: z
    .object({
      assistant_total_ms: z.number(),
      assistant_pre_reasoning_ms: z.number(),
      assistant_reasoning_ms: z.number(),
      assistant_between_reasoning_and_tool_ms: z.number(),
      assistant_post_tool_ms: z.number(),
      tool_total_ms: z.number(),
      tool_bash_ms: z.number(),
      tool_structured_output_ms: z.number(),
      observed_assistant_turns: z.number(),
    })
    .optional(),
  tokens: z.object({
    input: z.number(),
    output: z.number(),
    reasoning: z.number(),
    cache_read: z.number(),
    cache_write: z.number(),
    total: z.number(),
  }),
  cost: z.number(),
  tool_calls: z.number(),
  api_calls: z.number(),
  internal_retry_count: z.number(),
  external_retry_count: z.number(),
  model: z.object({
    provider_id: z.string(),
    model_id: z.string(),
    mode: z.string().nullable(),
  }),
  git: z.object({
    repo: z.string().nullable(),
    commit: z.string().nullable(),
  }),
  error: z
    .object({
      type: z.string(),
      message: z.string(),
    })
    .nullable(),
})
