import { z } from "zod"

/**
 * Checkpoint condition variants (discriminated union).
 *
 * Each variant describes a rule that must hold against the live GitHub
 * state fetched by the {@link CheckpointScorer} after an agent session:
 *
 * - `non_empty`: Passes when the task result array is non-empty.
 * - `empty`: Passes when the task result array is empty.
 * - `count_gte`: Passes when the result count is ≥ `value`.
 * - `count_eq`: Passes when the result count equals `value`.
 * - `field_equals`: Passes when `result[path]` strictly equals `value`. Value must be a primitive (string, number, boolean, or null).
 * - `field_contains`: Passes when `result[path]` contains the `value` substring.
 * - `custom`: Delegates to a named custom scorer function (v2 — not yet implemented).
 */
const CheckpointConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("non_empty") }),
  z.object({ type: z.literal("empty") }),
  z.object({ type: z.literal("count_gte"), value: z.number() }),
  z.object({ type: z.literal("count_eq"), value: z.number() }),
  z.object({
    type: z.literal("field_equals"),
    path: z.string(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  }),
  z.object({
    type: z.literal("field_contains"),
    path: z.string(),
    value: z.string(),
  }),
  z.object({ type: z.literal("custom"), scorer: z.string() }),
])

const CheckpointSchema = z.object({
  /** Unique identifier for this checkpoint within its scenario. */
  id: z.string().min(1),
  /** Human-readable description of what is being asserted. */
  description: z.string().min(1),
  /** ghx capability task name, e.g. `"pr.commits.list"`. */
  task: z.string().min(1),
  /** Input passed to the capability task when evaluating this checkpoint. */
  input: z.record(z.string(), z.unknown()),
  /** Condition that the task result must satisfy. */
  condition: CheckpointConditionSchema,
})

const FixtureRequirementsSchema = z.object({
  /** GitHub repo providing the fixture resources in `"owner/repo"` format. */
  repo: z.string(),
  /** List of fixture names (keys in the manifest) this scenario depends on. */
  requires: z.array(z.string()),
  /** Map of template variable names to fixture manifest paths used for `{{variable}}` substitution. */
  bindings: z.record(z.string(), z.string()),
  /** When `true`, reset fixture branches to their original SHAs before each iteration. */
  reseedPerIteration: z.boolean().default(false),
})

const AssertionsSchema = z.object({
  /** Ordered list of checkpoints evaluated after the agent session completes. */
  checkpoints: z.array(CheckpointSchema),
  /** Expected ordered sequence of tool names (informational, not enforced). */
  expectedToolSequence: z.array(z.string()).optional(),
  /** Expected ghx capability names the agent should invoke (informational, not enforced). */
  expectedCapabilities: z.array(z.string()).optional(),
})

// ID must match: lowercase alphanumeric words separated by dashes, ending with -NNN
const SCENARIO_ID_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}$/

/**
 * Zod schema for {@link EvalScenario}.
 *
 * @example
 * ```typescript
 * const scenario = EvalScenarioSchema.parse(JSON.parse(fs.readFileSync("scenario.json", "utf-8")))
 * ```
 */
export const EvalScenarioSchema = z.object({
  /** Unique scenario ID matching `^[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}$`, e.g. `pr-fix-mixed-threads-001`. */
  id: z.string().regex(SCENARIO_ID_REGEX, "Scenario ID must match pattern: <words>-NNN"),
  /** Short display name for this scenario. */
  name: z.string().min(1),
  /** Full description of the scenario's purpose and context. */
  description: z.string().min(1),
  /** The task prompt sent to the agent under evaluation. */
  prompt: z.string().min(1),
  /** Maximum time in milliseconds the agent may take to complete the task. */
  timeoutMs: z.number().int().positive(),
  /** Number of additional attempts permitted after the initial run. Default: `0`. */
  allowedRetries: z.number().int().min(0).default(0),
  /** Arbitrary string tags for filtering and grouping scenarios. */
  tags: z.array(z.string()).default([]),
  /** High-level GitHub domain this scenario exercises. */
  category: z.enum(["pr", "issue", "workflow", "release", "repo"]),
  /** Complexity level used for reporting and scenario selection. */
  difficulty: z.enum(["basic", "intermediate", "advanced"]),
  /** GitHub fixture requirements; omit when the scenario needs no live fixtures. */
  fixture: FixtureRequirementsSchema.optional(),
  /** Assertion checkpoints evaluated after the agent session completes. */
  assertions: AssertionsSchema,
})

/**
 * A single eval scenario: the task prompt, GitHub fixture requirements,
 * and assertion checkpoints that determine pass/fail.
 *
 * Scenario IDs must match `^[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}$`
 * (e.g. `pr-fix-mixed-threads-001`).
 */
export type EvalScenario = z.infer<typeof EvalScenarioSchema>
export type Checkpoint = z.infer<typeof CheckpointSchema>

/**
 * Discriminated union of all supported checkpoint condition types.
 *
 * Used by {@link CheckpointScorer} to evaluate live GitHub state against
 * expected post-session outcomes.
 */
export type CheckpointCondition = z.infer<typeof CheckpointConditionSchema>
export type FixtureRequirements = z.infer<typeof FixtureRequirementsSchema>
