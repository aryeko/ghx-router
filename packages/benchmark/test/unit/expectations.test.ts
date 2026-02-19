import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  expectationsConfigExists,
  inferModelSignatureFromRows,
  loadExpectationsConfig,
  normalizeGateProfile,
  resolveGateThresholdsForModel,
  resolveModelForExpectations,
} from "@bench/report/expectations.js"
import { describe, expect, it } from "vitest"

describe("expectations config", () => {
  it("loads and resolves thresholds for model", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-expectations-"))
    const path = join(root, "expectations.json")
    await writeFile(
      path,
      JSON.stringify({
        default_model: "openai/gpt-5.1-codex-mini",
        expectations: {
          "openai/gpt-5.1-codex-mini": {
            verify_pr: {
              minTokensActiveReductionPct: 10,
              minLatencyReductionPct: 10,
              minToolCallReductionPct: 15,
              minEfficiencyCoveragePct: 70,
              maxSuccessRateDropPct: 6,
              minOutputValidityRatePct: 95,
              maxRunnerFailureRatePct: 7,
              maxTimeoutStallRatePct: 4,
              maxRetryRatePct: 20,
              minSamplesPerScenarioPerMode: 1,
              minCostReductionPct: 10,
            },
            verify_release: {
              minTokensActiveReductionPct: 12,
              minLatencyReductionPct: 12,
              minToolCallReductionPct: 18,
              minEfficiencyCoveragePct: 75,
              maxSuccessRateDropPct: 4,
              minOutputValidityRatePct: 96,
              maxRunnerFailureRatePct: 6,
              maxTimeoutStallRatePct: 3,
              maxRetryRatePct: 18,
              minSamplesPerScenarioPerMode: 1,
              minCostReductionPct: 15,
            },
          },
        },
      }),
      "utf8",
    )

    const config = await loadExpectationsConfig(path)
    const thresholds = resolveGateThresholdsForModel(config, "openai/gpt-5.1-codex-mini")
    expect(thresholds.verify_pr.maxSuccessRateDropPct).toBe(6)
  })

  it("infers single model signature from comparable rows", () => {
    const model = inferModelSignatureFromRows([
      {
        mode: "agent_direct",
        model: { provider_id: "openai", model_id: "gpt-5.1-codex-mini" },
      },
      {
        mode: "ghx",
        model: { provider_id: "openai", model_id: "gpt-5.1-codex-mini" },
      },
    ])

    expect(model).toBe("openai/gpt-5.1-codex-mini")
  })

  it("returns null when inferring model from empty rows", () => {
    expect(inferModelSignatureFromRows([])).toBeNull()
  })

  it("prefers agent_direct or ghx rows when inferring model signature", () => {
    const model = inferModelSignatureFromRows([
      {
        mode: "mcp",
        model: { provider_id: "fallback", model_id: "model" },
      },
      {
        mode: "ghx",
        model: { provider_id: "openai", model_id: "gpt-5.1-codex-mini" },
      },
    ])

    expect(model).toBe("openai/gpt-5.1-codex-mini")
  })

  it("fails when rows resolve to multiple model signatures", () => {
    expect(() =>
      inferModelSignatureFromRows([
        {
          mode: "agent_direct",
          model: { provider_id: "openai", model_id: "gpt-5.1-codex-mini" },
        },
        {
          mode: "ghx",
          model: { provider_id: "anthropic", model_id: "claude-sonnet" },
        },
      ]),
    ).toThrow("Unable to infer single model signature")
  })

  it("uses explicit expectations model over inferred/default", () => {
    const resolved = resolveModelForExpectations(
      "openai/gpt-5.1-codex-mini",
      "openai/gpt-5.3-codex",
      {
        default_model: "openai/gpt-5.3-codex",
        expectations: {
          "openai/gpt-5.1-codex-mini": {
            verify_pr: {
              minTokensActiveReductionPct: 10,
              minLatencyReductionPct: 10,
              minToolCallReductionPct: 15,
              minEfficiencyCoveragePct: 70,
              maxSuccessRateDropPct: 6,
              minOutputValidityRatePct: 95,
              maxRunnerFailureRatePct: 7,
              maxTimeoutStallRatePct: 4,
              maxRetryRatePct: 20,
              minSamplesPerScenarioPerMode: 1,
              minCostReductionPct: 10,
            },
            verify_release: {
              minTokensActiveReductionPct: 12,
              minLatencyReductionPct: 12,
              minToolCallReductionPct: 18,
              minEfficiencyCoveragePct: 75,
              maxSuccessRateDropPct: 4,
              minOutputValidityRatePct: 96,
              maxRunnerFailureRatePct: 6,
              maxTimeoutStallRatePct: 3,
              maxRetryRatePct: 18,
              minSamplesPerScenarioPerMode: 1,
              minCostReductionPct: 15,
            },
          },
          "openai/gpt-5.3-codex": {
            verify_pr: {
              minTokensActiveReductionPct: 15,
              minLatencyReductionPct: 15,
              minToolCallReductionPct: 20,
              minEfficiencyCoveragePct: 80,
              maxSuccessRateDropPct: 3,
              minOutputValidityRatePct: 97,
              maxRunnerFailureRatePct: 5,
              maxTimeoutStallRatePct: 2,
              maxRetryRatePct: 15,
              minSamplesPerScenarioPerMode: 1,
              minCostReductionPct: 10,
            },
            verify_release: {
              minTokensActiveReductionPct: 22,
              minLatencyReductionPct: 20,
              minToolCallReductionPct: 30,
              minEfficiencyCoveragePct: 95,
              maxSuccessRateDropPct: 1,
              minOutputValidityRatePct: 99,
              maxRunnerFailureRatePct: 2,
              maxTimeoutStallRatePct: 1,
              maxRetryRatePct: 8,
              minSamplesPerScenarioPerMode: 2,
              minCostReductionPct: 15,
            },
          },
        },
      },
    )

    expect(resolved).toBe("openai/gpt-5.1-codex-mini")
  })

  it("falls back to inferred and then default expectations model", () => {
    const config = {
      default_model: "openai/gpt-default",
      expectations: {
        "openai/gpt-default": {
          verify_pr: {
            minTokensActiveReductionPct: 10,
            minLatencyReductionPct: 10,
            minToolCallReductionPct: 15,
            minEfficiencyCoveragePct: 70,
            maxSuccessRateDropPct: 6,
            minOutputValidityRatePct: 95,
            maxRunnerFailureRatePct: 7,
            maxTimeoutStallRatePct: 4,
            maxRetryRatePct: 20,
            minSamplesPerScenarioPerMode: 1,
            minCostReductionPct: 10,
          },
          verify_release: {
            minTokensActiveReductionPct: 12,
            minLatencyReductionPct: 12,
            minToolCallReductionPct: 18,
            minEfficiencyCoveragePct: 75,
            maxSuccessRateDropPct: 4,
            minOutputValidityRatePct: 96,
            maxRunnerFailureRatePct: 6,
            maxTimeoutStallRatePct: 3,
            maxRetryRatePct: 18,
            minSamplesPerScenarioPerMode: 1,
            minCostReductionPct: 12,
          },
        },
      },
    }

    expect(resolveModelForExpectations(null, "openai/gpt-inferred", config)).toBe(
      "openai/gpt-inferred",
    )
    expect(resolveModelForExpectations(null, null, config)).toBe("openai/gpt-default")
  })

  it("checks expectations config file existence", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-expectations-"))
    const existing = join(root, "exists.json")
    const missing = join(root, "missing.json")
    await writeFile(existing, "{}", "utf8")

    await expect(expectationsConfigExists(existing)).resolves.toBe(true)
    await expect(expectationsConfigExists(missing)).resolves.toBe(false)
  })

  it("fails when resolving thresholds for unknown model", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-expectations-"))
    const path = join(root, "expectations.json")
    await writeFile(
      path,
      JSON.stringify({
        default_model: "openai/gpt-5.1-codex-mini",
        expectations: {
          "openai/gpt-5.1-codex-mini": {
            verify_pr: {
              minTokensActiveReductionPct: 10,
              minLatencyReductionPct: 10,
              minToolCallReductionPct: 15,
              minEfficiencyCoveragePct: 70,
              maxSuccessRateDropPct: 6,
              minOutputValidityRatePct: 95,
              maxRunnerFailureRatePct: 7,
              maxTimeoutStallRatePct: 4,
              maxRetryRatePct: 20,
              minSamplesPerScenarioPerMode: 1,
              minCostReductionPct: 10,
            },
            verify_release: {
              minTokensActiveReductionPct: 12,
              minLatencyReductionPct: 12,
              minToolCallReductionPct: 18,
              minEfficiencyCoveragePct: 75,
              maxSuccessRateDropPct: 4,
              minOutputValidityRatePct: 96,
              maxRunnerFailureRatePct: 6,
              maxTimeoutStallRatePct: 3,
              maxRetryRatePct: 18,
              minSamplesPerScenarioPerMode: 1,
              minCostReductionPct: 15,
            },
          },
        },
      }),
      "utf8",
    )

    const config = await loadExpectationsConfig(path)
    expect(() => resolveGateThresholdsForModel(config, "openai/unknown")).toThrow(
      "No expectations configured for model",
    )
  })

  it("normalizes and validates gate profiles", () => {
    expect(normalizeGateProfile("verify_pr")).toBe("verify_pr")
    expect(normalizeGateProfile("verify_release")).toBe("verify_release")
    expect(() => normalizeGateProfile("invalid")).toThrow("Unknown gate profile")
  })
})
