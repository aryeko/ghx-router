import type { FixtureManifest, Scenario } from "../domain/types.js"
import { resetMixedPrThreads } from "./seed-pr-mixed-threads.js"
import { resetPrReviewThreads } from "./seed-pr-reviews.js"

type ResetFn = (repo: string, prNumber: number, token: string) => void

const RESET_REGISTRY: Record<string, ResetFn> = {
  pr_with_mixed_threads: resetMixedPrThreads,
  pr_with_reviews: resetPrReviewThreads,
}

export function resetScenarioFixtures(
  scenario: Scenario,
  manifest: FixtureManifest,
  reviewerToken: string | null,
): void {
  if (scenario.fixture?.reseed_per_iteration !== true) {
    return
  }

  if (!reviewerToken) {
    console.warn(
      `[benchmark] warn: reseed_per_iteration=true for scenario '${scenario.id}' but no reviewer token — skipping reset`,
    )
    return
  }

  const requires = scenario.fixture.requires ?? []

  for (const resource of requires) {
    const resetFn = RESET_REGISTRY[resource]
    if (!resetFn) {
      continue
    }

    const raw = manifest.resources[resource]
    if (typeof raw !== "object" || raw === null) {
      console.warn(
        `[benchmark] warn: fixture resource '${resource}' missing from manifest for scenario '${scenario.id}' — skipping reset`,
      )
      continue
    }

    const prNumber = (raw as Record<string, unknown>)["number"]
    if (typeof prNumber !== "number" || prNumber === 0) {
      console.warn(
        `[benchmark] warn: fixture resource '${resource}' has no valid .number for scenario '${scenario.id}' — skipping reset`,
      )
      continue
    }

    try {
      resetFn(manifest.repo.full_name, prNumber, reviewerToken)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        `[benchmark] warn: reset of '${resource}' for scenario '${scenario.id}' failed: ${message} — continuing`,
      )
    }
  }
}
