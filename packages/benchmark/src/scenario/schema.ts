import { z } from "zod"

import type { Scenario } from "../domain/types.js"

const assertionsSchema = z
  .object({
    must_succeed: z.boolean(),
    expect_valid_output: z.boolean().optional(),
    required_fields: z.array(z.string()).optional(),
    required_data_fields: z.array(z.string()).optional(),
    required_meta_fields: z.array(z.string()).optional(),
    data_type: z.enum(["array", "object"]).optional(),
    expected_route_used: z.enum(["cli", "graphql", "rest"]).optional(),
    expected_error_code: z.string().min(1).optional(),
    require_tool_calls: z.boolean().optional(),
    min_tool_calls: z.number().int().nonnegative().optional(),
    max_tool_calls: z.number().int().nonnegative().optional(),
    require_attempt_trace: z.boolean().optional()
  })
  .superRefine((value, context) => {
    if (
      value.min_tool_calls !== undefined &&
      value.max_tool_calls !== undefined &&
      value.max_tool_calls < value.min_tool_calls
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["max_tool_calls"],
        message: "max_tool_calls must be greater than or equal to min_tool_calls"
      })
    }
  })

const scenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  task: z.string().min(1),
  input: z.record(z.unknown()),
  prompt_template: z.string().min(1),
  timeout_ms: z.number().positive(),
  allowed_retries: z.number().int().nonnegative(),
  fixture: z
    .object({
      repo: z.string().optional(),
      workdir: z.string().optional(),
      branch: z.string().optional()
    })
    .optional(),
  assertions: assertionsSchema,
  tags: z.array(z.string())
})

export function validateScenario(raw: unknown): Scenario {
  return scenarioSchema.parse(raw) as Scenario
}
