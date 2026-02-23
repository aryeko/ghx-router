import { z } from "zod"

import type { Scenario } from "../domain/types.js"

const workflowCheckpointSchema = z.object({
  name: z.string().min(1),
  verification_task: z.string().min(1),
  verification_input: z.record(z.string(), z.unknown()),
  condition: z.enum(["empty", "non_empty", "count_gte", "count_eq", "field_equals"]),
  expected_value: z.unknown().optional(),
  verification_field: z.string().min(1).optional(),
})

const workflowAssertionsSchema = z
  .object({
    expected_outcome: z.enum(["success", "expected_error"]),
    checkpoints: z.array(workflowCheckpointSchema).min(1),
  })
  .superRefine((value, context) => {
    for (const [i, checkpoint] of value.checkpoints.entries()) {
      if (
        ["count_gte", "count_eq", "field_equals"].includes(checkpoint.condition) &&
        checkpoint.expected_value === undefined
      ) {
        context.addIssue({
          code: "custom",
          path: ["checkpoints", i, "expected_value"],
          message: `checkpoint with condition '${checkpoint.condition}' must specify expected_value`,
        })
      }
    }
  })

const fixtureSchema = z
  .object({
    repo: z.string().optional(),
    workdir: z.string().optional(),
    branch: z.string().optional(),
    bindings: z.record(z.string(), z.string().min(1)).optional(),
    requires: z.array(z.string().min(1)).optional(),
    reseed_per_iteration: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (!value.bindings) {
      return
    }

    for (const [destination, source] of Object.entries(value.bindings)) {
      if (!destination.startsWith("input.")) {
        context.addIssue({
          code: "custom",
          path: ["bindings", destination],
          message: "fixture binding destination must start with 'input.'",
        })
      }

      if (!source.includes(".")) {
        context.addIssue({
          code: "custom",
          path: ["bindings", destination],
          message: "fixture binding source must be a dotted manifest path",
        })
      }
    }
  })
  .optional()

const workflowScenarioSchema = z.object({
  type: z.literal("workflow"),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-wf-\d{3}$/),
  name: z.string().min(1),
  prompt: z.string().min(1),
  expected_capabilities: z.array(z.string().min(1)).min(1),
  timeout_ms: z.number().positive(),
  allowed_retries: z.number().int().nonnegative(),
  fixture: fixtureSchema,
  assertions: workflowAssertionsSchema,
  tags: z.array(z.string()),
})

export function validateScenario(raw: unknown): Scenario {
  return workflowScenarioSchema.parse(raw) as Scenario
}
