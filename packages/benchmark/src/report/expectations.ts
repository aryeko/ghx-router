import { access, readFile } from "node:fs/promises"

import { z } from "zod"
import type { GateProfile, GateV2ThresholdMap } from "../domain/types.js"

const gateV2ThresholdSchema = z.object({
  minTokensActiveReductionPct: z.number(),
  minLatencyReductionPct: z.number(),
  minToolCallReductionPct: z.number(),
  minEfficiencyCoveragePct: z.number(),
  maxSuccessRateDropPct: z.number(),
  minOutputValidityRatePct: z.number(),
  maxRunnerFailureRatePct: z.number(),
  maxTimeoutStallRatePct: z.number(),
  maxRetryRatePct: z.number(),
  minSamplesPerScenarioPerMode: z.number().int().min(1),
  minCostReductionPct: z.number(),
})

const expectationsSchema = z.object({
  default_model: z.string().min(1),
  expectations: z.record(
    z.string(),
    z.object({
      verify_pr: gateV2ThresholdSchema,
      verify_release: gateV2ThresholdSchema,
    }),
  ),
})

export type ModelExpectationsConfig = z.infer<typeof expectationsSchema>

export async function loadExpectationsConfig(path: string): Promise<ModelExpectationsConfig> {
  const raw = await readFile(path, "utf8")
  return expectationsSchema.parse(JSON.parse(raw))
}

export async function expectationsConfigExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export function resolveGateThresholdsForModel(
  config: ModelExpectationsConfig,
  model: string,
): GateV2ThresholdMap {
  const thresholdSet = config.expectations[model]
  if (!thresholdSet) {
    const known = Object.keys(config.expectations).sort().join(", ")
    throw new Error(`No expectations configured for model '${model}'. Known models: ${known}`)
  }

  return {
    verify_pr: thresholdSet.verify_pr,
    verify_release: thresholdSet.verify_release,
  }
}

export function inferModelSignatureFromRows(
  rows: Array<{ mode: string; model: { provider_id: string; model_id: string } }>,
): string | null {
  const preferredRows = rows.filter((row) => row.mode === "agent_direct" || row.mode === "ghx")
  const sourceRows = preferredRows.length > 0 ? preferredRows : rows

  if (sourceRows.length === 0) {
    return null
  }

  const signatures = Array.from(
    new Set(sourceRows.map((row) => `${row.model.provider_id}/${row.model.model_id}`)),
  ).sort()

  if (signatures.length > 1) {
    throw new Error(`Unable to infer single model signature from rows: ${signatures.join(", ")}`)
  }

  return signatures[0] ?? null
}

export function resolveModelForExpectations(
  argsModel: string | null,
  inferredModel: string | null,
  config: ModelExpectationsConfig,
): string {
  return argsModel ?? inferredModel ?? config.default_model
}

export function normalizeGateProfile(profile: string): GateProfile {
  if (profile === "verify_pr" || profile === "verify_release") {
    return profile
  }

  throw new Error(`Unknown gate profile: ${profile}`)
}
