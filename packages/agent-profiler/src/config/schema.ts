import { z } from "zod"
import {
  DEFAULT_ALLOWED_RETRIES,
  DEFAULT_LOG_LEVEL,
  DEFAULT_REPETITIONS,
  DEFAULT_REPORTS_DIR,
  DEFAULT_RESULTS_DIR,
  DEFAULT_SESSION_EXPORT,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_WARMUP,
} from "../shared/constants.js"

/**
 * Zod schema for validating and parsing the profiler configuration file.
 *
 * Supports snake_case keys from YAML (pre-processed to camelCase before parsing).
 * All execution and output fields have defaults so only `modes` and `scenarios`
 * are strictly required.
 */
export const ProfilerConfigSchema = z.object({
  modes: z.array(z.string()).min(1),
  scenarios: z.object({
    set: z.string().optional(),
    ids: z.array(z.string()).optional(),
  }),
  execution: z
    .object({
      repetitions: z.number().int().positive().default(DEFAULT_REPETITIONS),
      warmup: z.boolean().default(DEFAULT_WARMUP),
      timeoutDefaultMs: z.number().positive().default(DEFAULT_TIMEOUT_MS),
      allowedRetries: z.number().int().min(0).default(DEFAULT_ALLOWED_RETRIES),
    })
    .default({}),
  output: z
    .object({
      resultsDir: z.string().default(DEFAULT_RESULTS_DIR),
      reportsDir: z.string().default(DEFAULT_REPORTS_DIR),
      sessionExport: z.boolean().default(DEFAULT_SESSION_EXPORT),
      logLevel: z.enum(["debug", "info", "warn", "error"]).default(DEFAULT_LOG_LEVEL),
    })
    .default({}),
  extensions: z.record(z.unknown()).default({}),
})

/** TypeScript type inferred from ProfilerConfigSchema. */
export type ProfilerConfig = z.infer<typeof ProfilerConfigSchema>
