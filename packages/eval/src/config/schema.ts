import { z } from "zod"

const ModelSchema = z.object({
  /** Unique model identifier, e.g. `"openai/gpt-4o"`. */
  id: z.string().min(1),
  /** Human-readable label shown in reports, e.g. `"GPT-4o"`. */
  label: z.string().min(1),
})

const ProviderBaseSchema = z.object({
  /** Provider identifier, e.g. `"opencode"`. */
  id: z.string().default("opencode"),
  /** TCP port the provider server listens on. Default: `3001`. */
  port: z.number().int().positive().default(3001),
})

const ProviderSchema = ProviderBaseSchema.default(ProviderBaseSchema.parse({}))

const ScenariosBaseSchema = z.object({
  /** Named scenario set to run (from `scenario-sets.json`). */
  set: z.string().optional(),
  /** Explicit list of scenario IDs to run. Takes precedence over `set`. */
  ids: z.array(z.string()).optional(),
})

const ScenariosSchema = ScenariosBaseSchema.default(ScenariosBaseSchema.parse({}))

const ExecutionBaseSchema = z.object({
  /** Number of full repetitions per scenario per mode. Default: `5`. */
  repetitions: z.number().int().positive().default(5),
  /** Whether to run a warm-up canary pass before the timed repetitions. Default: `true`. */
  warmup: z.boolean().default(true),
  /** Per-prompt timeout in milliseconds. Default: `120_000` (2 minutes). */
  timeout_default_ms: z.number().int().positive().default(120_000),
})

const ExecutionSchema = ExecutionBaseSchema.default(ExecutionBaseSchema.parse({}))

const OutputBaseSchema = z.object({
  /** Directory for raw JSONL result files. Default: `"results"`. */
  results_dir: z.string().default("results"),
  /** Directory for rendered summary reports. Default: `"reports"`. */
  reports_dir: z.string().default("reports"),
  /** When `true`, write per-session trace JSON files to `reports_dir/sessions/`. */
  session_export: z.boolean().default(true),
  /** Minimum log level for console output. One of `"debug" | "info" | "warn" | "error"`. */
  log_level: z.enum(["debug", "info", "warn", "error"]).default("info"),
})

const OutputSchema = OutputBaseSchema.default(OutputBaseSchema.parse({}))

const FixturesBaseSchema = z.object({
  /** GitHub repo containing fixture resources in `"owner/repo"` format. */
  repo: z.string().default(""),
  /** Path to the fixture manifest JSON file. Default: `"fixtures/latest.json"`. */
  manifest: z.string().default("fixtures/latest.json"),
  /** Auto-seed fixtures if the manifest is absent. Requires GitHub auth. Default: `false`. */
  seed_if_missing: z.boolean().default(false),
  /** Re-seed all fixture resources between mode groups (not per iteration). Default: `false`. */
  reseed_between_modes: z.boolean().default(false),
})

const FixturesSchema = FixturesBaseSchema.default(FixturesBaseSchema.parse({}))

/**
 * Zod schema for {@link EvalConfig}.
 *
 * Useful for consumers that need to validate partial config objects or
 * extend the schema with domain-specific fields.
 *
 * @example
 * ```typescript
 * import { EvalConfigSchema } from "@ghx-dev/eval"
 * const config = EvalConfigSchema.parse(yaml.load(yamlString))
 * ```
 */
export const EvalConfigSchema = z.object({
  /** Ordered list of evaluation modes to run, e.g. `["ghx", "mcp", "baseline"]`. */
  modes: z.array(z.enum(["ghx", "mcp", "baseline"])).min(1),
  /** Scenario selection: run a named set or a specific list of IDs. */
  scenarios: ScenariosSchema,
  /** Execution parameters: repetitions, warm-up, and per-prompt timeout. */
  execution: ExecutionSchema,
  /** Output configuration: directories, log level, and session export toggle. */
  output: OutputSchema,
  /** Provider configuration: which provider to use and on which port. */
  provider: ProviderSchema,
  /** Models to evaluate. Each entry is run for every scenario × mode combination. */
  models: z.array(ModelSchema).min(1),
  /** Fixture configuration: location and seeding behavior of GitHub test fixtures. */
  fixtures: FixturesSchema,
})

/**
 * Root configuration for an eval run.
 *
 * Parse from YAML with {@link loadEvalConfig}, or validate a raw object
 * directly via `EvalConfigSchema.parse(raw)`.
 */
export type EvalConfig = z.infer<typeof EvalConfigSchema>
export type EvalModel = z.infer<typeof ModelSchema>
