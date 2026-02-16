import { z } from "zod"

import type { Scenario } from "../domain/types.js"

const assertionsSchema = z
  .object({
    expected_outcome: z.enum(["success", "expected_error"]).optional(),
    must_succeed: z.boolean().optional(),
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
    if (value.expected_outcome === undefined && value.must_succeed === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expected_outcome"],
        message: "either expected_outcome or must_succeed must be provided"
      })
    }

    if (value.expected_outcome !== undefined && value.must_succeed !== undefined) {
      const expectedFromLegacy = value.must_succeed ? "success" : "expected_error"
      if (value.expected_outcome !== expectedFromLegacy) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expected_outcome"],
          message: "expected_outcome conflicts with must_succeed"
        })
      }
    }

    const expectedOutcome = value.expected_outcome ?? (value.must_succeed === false ? "expected_error" : "success")
    if (expectedOutcome === "expected_error" && value.expected_error_code === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expected_error_code"],
        message: "expected_error scenarios must specify expected_error_code"
      })
    }

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
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}$/),
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
      branch: z.string().optional(),
      bindings: z.record(z.string().min(1)).optional(),
      requires: z.array(z.string().min(1)).optional()
    })
    .superRefine((value, context) => {
      if (!value.bindings) {
        return
      }

      for (const [destination, source] of Object.entries(value.bindings)) {
        if (!destination.startsWith("input.")) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["bindings", destination],
            message: "fixture binding destination must start with 'input.'"
          })
        }

        if (!source.includes(".")) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["bindings", destination],
            message: "fixture binding source must be a dotted manifest path"
          })
        }
      }
    })
    .optional(),
  assertions: assertionsSchema,
  tags: z.array(z.string())
})

export function validateScenario(raw: unknown): Scenario {
  return scenarioSchema.parse(raw) as Scenario
}
