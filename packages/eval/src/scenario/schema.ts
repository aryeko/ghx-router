import { z } from "zod"

// Checkpoint condition variants (discriminated union)
const CheckpointConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("non_empty") }),
  z.object({ type: z.literal("empty") }),
  z.object({ type: z.literal("count_gte"), value: z.number() }),
  z.object({ type: z.literal("count_eq"), value: z.number() }),
  z.object({
    type: z.literal("field_equals"),
    path: z.string(),
    value: z.unknown(),
  }),
  z.object({
    type: z.literal("field_contains"),
    path: z.string(),
    value: z.string(),
  }),
  z.object({ type: z.literal("custom"), scorer: z.string() }),
])

const CheckpointSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  task: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  condition: CheckpointConditionSchema,
})

const FixtureRequirementsSchema = z.object({
  repo: z.string(),
  requires: z.array(z.string()),
  bindings: z.record(z.string(), z.string()),
  reseedPerIteration: z.boolean().default(false),
})

const AssertionsSchema = z.object({
  checkpoints: z.array(CheckpointSchema),
  expectedToolSequence: z.array(z.string()).optional(),
  expectedCapabilities: z.array(z.string()).optional(),
})

// ID must match: lowercase alphanumeric words separated by dashes, ending with -NNN
const SCENARIO_ID_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}$/

export const EvalScenarioSchema = z.object({
  id: z.string().regex(SCENARIO_ID_REGEX, "Scenario ID must match pattern: <words>-NNN"),
  name: z.string().min(1),
  description: z.string().min(1),
  prompt: z.string().min(1),
  timeoutMs: z.number().int().positive(),
  allowedRetries: z.number().int().min(0).default(0),
  tags: z.array(z.string()).default([]),
  category: z.enum(["pr", "issue", "workflow", "release", "repo"]),
  difficulty: z.enum(["basic", "intermediate", "advanced"]),
  fixture: FixtureRequirementsSchema.optional(),
  assertions: AssertionsSchema,
})

export type EvalScenario = z.infer<typeof EvalScenarioSchema>
export type Checkpoint = z.infer<typeof CheckpointSchema>
export type CheckpointCondition = z.infer<typeof CheckpointConditionSchema>
export type FixtureRequirements = z.infer<typeof FixtureRequirementsSchema>
