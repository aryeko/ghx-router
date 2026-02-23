import type { FixtureManifest, Scenario } from "@bench/domain/types.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

const resetMixedPrThreadsMock = vi.hoisted(() => vi.fn())
const resetPrReviewThreadsMock = vi.hoisted(() => vi.fn())
const resetWorkflowRunMock = vi.hoisted(() => vi.fn())
const reseedWorkflowRunMock = vi.hoisted(() => vi.fn())
const resetIssueTriageMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/fixture/seed-pr-mixed-threads.js", () => ({
  resetMixedPrThreads: resetMixedPrThreadsMock,
}))
vi.mock("@bench/fixture/seed-pr-reviews.js", () => ({
  resetPrReviewThreads: resetPrReviewThreadsMock,
}))
vi.mock("@bench/fixture/seed-workflow.js", () => ({
  resetWorkflowRun: resetWorkflowRunMock,
  reseedWorkflowRun: reseedWorkflowRunMock,
}))
vi.mock("@bench/fixture/seed-issue.js", () => ({
  resetIssueTriage: resetIssueTriageMock,
}))

import { resetScenarioFixtures } from "@bench/fixture/reset.js"

const baseManifest: FixtureManifest = {
  version: 1,
  repo: {
    owner: "test-owner",
    name: "test-repo",
    full_name: "test-owner/test-repo",
    default_branch: "main",
  },
  resources: {
    pr_with_mixed_threads: { number: 42, id: "node1" },
    pr_with_reviews: { number: 7, id: "node2" },
  },
}

function makeScenario(overrides: Partial<Scenario["fixture"]> = {}): Scenario {
  return {
    type: "workflow",
    id: "test-wf-001",
    name: "Test Scenario",
    prompt: "Do something",
    expected_capabilities: [],
    timeout_ms: 60000,
    allowed_retries: 0,
    assertions: { expected_outcome: "success", checkpoints: [] },
    tags: [],
    fixture: { reseed_per_iteration: true, requires: [], ...overrides },
  }
}

describe("resetScenarioFixtures", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns early when reseed_per_iteration is not set", async () => {
    const scenario = makeScenario({})
    // Ensure reseed_per_iteration is absent
    delete scenario.fixture?.reseed_per_iteration
    await resetScenarioFixtures(scenario, baseManifest, "token123")
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled()
    expect(resetPrReviewThreadsMock).not.toHaveBeenCalled()
  })

  it("returns early when reseed_per_iteration is false", async () => {
    const scenario = makeScenario({ reseed_per_iteration: false })
    await resetScenarioFixtures(scenario, baseManifest, "token123")
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled()
    expect(resetPrReviewThreadsMock).not.toHaveBeenCalled()
  })

  it("warns and returns early when reviewerToken is null", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const scenario = makeScenario({ requires: ["pr_with_mixed_threads"] })
    await resetScenarioFixtures(scenario, baseManifest, null)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no reviewer token"))
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it("warns and returns early when reviewerToken is empty string", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const scenario = makeScenario({ requires: ["pr_with_mixed_threads"] })
    await resetScenarioFixtures(scenario, baseManifest, "")
    expect(warnSpy).toHaveBeenCalled()
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it("calls resetMixedPrThreads with correct args", async () => {
    const scenario = makeScenario({ requires: ["pr_with_mixed_threads"] })
    await resetScenarioFixtures(scenario, baseManifest, "token123")
    expect(resetMixedPrThreadsMock).toHaveBeenCalledWith("test-owner/test-repo", 42, "token123")
  })

  it("calls resetPrReviewThreads with correct args", async () => {
    const scenario = makeScenario({ requires: ["pr_with_reviews"] })
    await resetScenarioFixtures(scenario, baseManifest, "token456")
    expect(resetPrReviewThreadsMock).toHaveBeenCalledWith("test-owner/test-repo", 7, "token456")
  })

  it("skips resource not in registry without throwing", async () => {
    const scenario = makeScenario({ requires: ["pr", "issue"] })
    const result = await resetScenarioFixtures(scenario, baseManifest, "token123")
    expect(result).toEqual(baseManifest)
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled()
    expect(resetPrReviewThreadsMock).not.toHaveBeenCalled()
  })

  it("warns and skips when manifest resource is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const scenario = makeScenario({ requires: ["pr_with_mixed_threads"] })
    const manifestWithoutResource: FixtureManifest = {
      ...baseManifest,
      resources: {},
    }
    await resetScenarioFixtures(scenario, manifestWithoutResource, "token123")
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("missing from manifest"))
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it("warns and skips when manifest resource has number === 0", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const scenario = makeScenario({ requires: ["pr_with_mixed_threads"] })
    const manifestWithZero: FixtureManifest = {
      ...baseManifest,
      resources: { pr_with_mixed_threads: { number: 0 } },
    }
    await resetScenarioFixtures(scenario, manifestWithZero, "token123")
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no valid id"))
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it("warns and skips when manifest resource has non-number in number field", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const scenario = makeScenario({ requires: ["pr_with_mixed_threads"] })
    const manifestBadType: FixtureManifest = {
      ...baseManifest,
      resources: { pr_with_mixed_threads: { number: "not-a-number" } },
    }
    await resetScenarioFixtures(scenario, manifestBadType, "token123")
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no valid id"))
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it("warns and continues when reset fn throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    resetMixedPrThreadsMock.mockImplementationOnce(() => {
      throw new Error("network error")
    })
    const scenario = makeScenario({
      requires: ["pr_with_mixed_threads", "pr_with_reviews"],
    })
    const result = await resetScenarioFixtures(scenario, baseManifest, "token123")
    expect(result).toEqual(baseManifest)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("network error"))
    // Second resource should still be called
    expect(resetPrReviewThreadsMock).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it("does nothing when requires is empty", async () => {
    const scenario = makeScenario({ requires: [] })
    await resetScenarioFixtures(scenario, baseManifest, "token123")
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled()
    expect(resetPrReviewThreadsMock).not.toHaveBeenCalled()
  })

  it("does nothing when fixture is undefined", async () => {
    const scenario: Scenario = {
      type: "workflow",
      id: "no-fixture",
      name: "No fixture",
      prompt: "Do something",
      expected_capabilities: [],
      timeout_ms: 60000,
      allowed_retries: 0,
      assertions: { expected_outcome: "success", checkpoints: [] },
      tags: [],
    }
    await resetScenarioFixtures(scenario, baseManifest, "token123")
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled()
  })

  it("calls resetIssueTriage with correct args when no reviewer token", async () => {
    const manifest: FixtureManifest = {
      ...baseManifest,
      resources: { issue_for_triage: { number: 15, id: "I_15" } },
    }
    const scenario = makeScenario({ requires: ["issue_for_triage"] })
    await resetScenarioFixtures(scenario, manifest, null)
    expect(resetIssueTriageMock).toHaveBeenCalledWith("test-owner/test-repo", 15, "")
  })

  it("calls resetIssueTriage when reviewer token is provided", async () => {
    const manifest: FixtureManifest = {
      ...baseManifest,
      resources: { issue_for_triage: { number: 20, id: "I_20" } },
    }
    const scenario = makeScenario({ requires: ["issue_for_triage"] })
    await resetScenarioFixtures(scenario, manifest, "reviewer-token")
    expect(resetIssueTriageMock).toHaveBeenCalledWith("test-owner/test-repo", 20, "reviewer-token")
  })

  it("runs issue_for_triage reset even when token-required resources are skipped", async () => {
    const manifest: FixtureManifest = {
      ...baseManifest,
      resources: {
        pr_with_mixed_threads: { number: 42, id: "node1" },
        issue_for_triage: { number: 30, id: "I_30" },
      },
    }
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const scenario = makeScenario({
      requires: ["pr_with_mixed_threads", "issue_for_triage"],
    })
    await resetScenarioFixtures(scenario, manifest, null)
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled()
    expect(resetIssueTriageMock).toHaveBeenCalledWith("test-owner/test-repo", 30, "")
    warnSpy.mockRestore()
  })

  it("returns new manifest with updated workflow_run resource when reseed succeeds", async () => {
    const manifest: FixtureManifest = {
      ...baseManifest,
      resources: { workflow_run: { id: 99999, number: 99999 } },
    }
    reseedWorkflowRunMock.mockResolvedValueOnce({ id: 12345, job_id: 1, check_run_id: 2 })
    const scenario = makeScenario({ requires: ["workflow_run"] })
    const result = await resetScenarioFixtures(scenario, manifest, null)
    expect(reseedWorkflowRunMock).toHaveBeenCalledWith("test-owner/test-repo", "default")
    expect(result.resources["workflow_run"]).toEqual({ id: 12345, number: 12345 })
    // Original manifest is not mutated
    expect(manifest.resources["workflow_run"]).toEqual({ id: 99999, number: 99999 })
  })

  it("returns original manifest when reseedWorkflowRun returns null", async () => {
    const manifest: FixtureManifest = {
      ...baseManifest,
      resources: { workflow_run: { id: 99999, number: 99999 } },
    }
    reseedWorkflowRunMock.mockResolvedValueOnce(null)
    const scenario = makeScenario({ requires: ["workflow_run"] })
    const result = await resetScenarioFixtures(scenario, manifest, null)
    expect(reseedWorkflowRunMock).toHaveBeenCalled()
    expect(result.resources["workflow_run"]).toEqual({ id: 99999, number: 99999 })
  })

  it("warns and continues when reseedWorkflowRun throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const manifest: FixtureManifest = {
      ...baseManifest,
      resources: { workflow_run: { id: 99999, number: 99999 } },
    }
    reseedWorkflowRunMock.mockRejectedValueOnce(new Error("dispatch failed"))
    const scenario = makeScenario({ requires: ["workflow_run"] })
    const result = await resetScenarioFixtures(scenario, manifest, null)
    expect(result).toEqual(manifest)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("dispatch failed"))
    warnSpy.mockRestore()
  })

  it("runs reseedWorkflowRun even when reviewer token is null", async () => {
    const manifest: FixtureManifest = {
      ...baseManifest,
      resources: { workflow_run: { id: 1, number: 1 } },
    }
    reseedWorkflowRunMock.mockResolvedValueOnce({ id: 555, job_id: null, check_run_id: null })
    const scenario = makeScenario({ requires: ["workflow_run"] })
    const result = await resetScenarioFixtures(scenario, manifest, null)
    expect(reseedWorkflowRunMock).toHaveBeenCalled()
    expect(result.resources["workflow_run"]).toEqual({ id: 555, number: 555 })
    // Original manifest is not mutated
    expect(manifest.resources["workflow_run"]).toEqual({ id: 1, number: 1 })
  })
})
