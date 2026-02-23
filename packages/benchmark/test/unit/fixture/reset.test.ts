import type { FixtureManifest, Scenario } from "@bench/domain/types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resetMixedPrThreadsMock = vi.hoisted(() => vi.fn());
const resetPrReviewThreadsMock = vi.hoisted(() => vi.fn());
const resetWorkflowRunMock = vi.hoisted(() => vi.fn());

vi.mock("@bench/fixture/seed-pr-mixed-threads.js", () => ({
  resetMixedPrThreads: resetMixedPrThreadsMock,
}));
vi.mock("@bench/fixture/seed-pr-reviews.js", () => ({
  resetPrReviewThreads: resetPrReviewThreadsMock,
}));
vi.mock("@bench/fixture/seed-workflow.js", () => ({
  resetWorkflowRun: resetWorkflowRunMock,
}));

import { resetScenarioFixtures } from "@bench/fixture/reset.js";

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
};

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
  };
}

describe("resetScenarioFixtures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early when reseed_per_iteration is not set", () => {
    const scenario = makeScenario({});
    // Ensure reseed_per_iteration is absent
    delete scenario.fixture?.reseed_per_iteration;
    resetScenarioFixtures(scenario, baseManifest, "token123");
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled();
    expect(resetPrReviewThreadsMock).not.toHaveBeenCalled();
  });

  it("returns early when reseed_per_iteration is false", () => {
    const scenario = makeScenario({ reseed_per_iteration: false });
    resetScenarioFixtures(scenario, baseManifest, "token123");
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled();
    expect(resetPrReviewThreadsMock).not.toHaveBeenCalled();
  });

  it("warns and returns early when reviewerToken is null", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const scenario = makeScenario({ requires: ["pr_with_mixed_threads"] });
    resetScenarioFixtures(scenario, baseManifest, null);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("no reviewer token"),
    );
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("warns and returns early when reviewerToken is empty string", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const scenario = makeScenario({ requires: ["pr_with_mixed_threads"] });
    resetScenarioFixtures(scenario, baseManifest, "");
    expect(warnSpy).toHaveBeenCalled();
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("calls resetMixedPrThreads with correct args", () => {
    const scenario = makeScenario({ requires: ["pr_with_mixed_threads"] });
    resetScenarioFixtures(scenario, baseManifest, "token123");
    expect(resetMixedPrThreadsMock).toHaveBeenCalledWith(
      "test-owner/test-repo",
      42,
      "token123",
    );
  });

  it("calls resetPrReviewThreads with correct args", () => {
    const scenario = makeScenario({ requires: ["pr_with_reviews"] });
    resetScenarioFixtures(scenario, baseManifest, "token456");
    expect(resetPrReviewThreadsMock).toHaveBeenCalledWith(
      "test-owner/test-repo",
      7,
      "token456",
    );
  });

  it("skips resource not in registry without throwing", () => {
    const scenario = makeScenario({ requires: ["pr", "issue"] });
    expect(() => {
      resetScenarioFixtures(scenario, baseManifest, "token123");
    }).not.toThrow();
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled();
    expect(resetPrReviewThreadsMock).not.toHaveBeenCalled();
  });

  it("warns and skips when manifest resource is missing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const scenario = makeScenario({ requires: ["pr_with_mixed_threads"] });
    const manifestWithoutResource: FixtureManifest = {
      ...baseManifest,
      resources: {},
    };
    resetScenarioFixtures(scenario, manifestWithoutResource, "token123");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("missing from manifest"),
    );
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("warns and skips when manifest resource has number === 0", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const scenario = makeScenario({ requires: ["pr_with_mixed_threads"] });
    const manifestWithZero: FixtureManifest = {
      ...baseManifest,
      resources: { pr_with_mixed_threads: { number: 0 } },
    };
    resetScenarioFixtures(scenario, manifestWithZero, "token123");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("no valid id"),
    );
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("warns and skips when manifest resource has non-number in number field", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const scenario = makeScenario({ requires: ["pr_with_mixed_threads"] });
    const manifestBadType: FixtureManifest = {
      ...baseManifest,
      resources: { pr_with_mixed_threads: { number: "not-a-number" } },
    };
    resetScenarioFixtures(scenario, manifestBadType, "token123");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("no valid id"),
    );
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("warns and continues when reset fn throws", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    resetMixedPrThreadsMock.mockImplementationOnce(() => {
      throw new Error("network error");
    });
    const scenario = makeScenario({
      requires: ["pr_with_mixed_threads", "pr_with_reviews"],
    });
    expect(() => {
      resetScenarioFixtures(scenario, baseManifest, "token123");
    }).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("network error"),
    );
    // Second resource should still be called
    expect(resetPrReviewThreadsMock).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("does nothing when requires is empty", () => {
    const scenario = makeScenario({ requires: [] });
    resetScenarioFixtures(scenario, baseManifest, "token123");
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled();
    expect(resetPrReviewThreadsMock).not.toHaveBeenCalled();
  });

  it("does nothing when fixture is undefined", () => {
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
    };
    resetScenarioFixtures(scenario, baseManifest, "token123");
    expect(resetMixedPrThreadsMock).not.toHaveBeenCalled();
  });
});
