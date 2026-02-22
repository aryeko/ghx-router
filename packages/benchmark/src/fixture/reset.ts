import type { FixtureManifest, Scenario } from "../domain/types.js"
import { resetIssueTriage } from "./seed-issue.js"
import { resetPrBugs } from "./seed-pr-bugs.js"
import { resetMixedPrThreads } from "./seed-pr-mixed-threads.js"
import { resetPrReviewThreads } from "./seed-pr-reviews.js"

type ResetFn = (repo: string, resourceNumber: number, token: string) => void

type ResetEntry = {
  fn: ResetFn
  requiresToken: boolean
}

const RESET_REGISTRY: Record<string, ResetEntry> = {
  pr_with_bugs: { fn: resetPrBugs, requiresToken: false },
  pr_with_mixed_threads: { fn: resetMixedPrThreads, requiresToken: true },
  pr_with_reviews: { fn: resetPrReviewThreads, requiresToken: true },
  issue_for_triage: { fn: resetIssueTriage, requiresToken: false },
}

export function resetScenarioFixtures(
  scenario: Scenario,
  manifest: FixtureManifest,
  reviewerToken: string | null,
): void {
  if (scenario.fixture?.reseed_per_iteration !== true) {
    return
  }

  const requires = scenario.fixture.requires ?? []

  for (const resource of requires) {
    const entry = RESET_REGISTRY[resource]
    if (!entry) {
      continue
    }

    if (entry.requiresToken && !reviewerToken) {
      console.warn(
        `[benchmark] warn: reseed_per_iteration=true for '${resource}' in scenario '${scenario.id}' but no reviewer token — skipping reset`,
      )
      continue
    }

    const raw = manifest.resources[resource]
    if (typeof raw !== "object" || raw === null) {
      console.warn(
        `[benchmark] warn: fixture resource '${resource}' missing from manifest for scenario '${scenario.id}' — skipping reset`,
      )
      continue
    }

    const resourceNumber = (raw as Record<string, unknown>)["number"]
    if (typeof resourceNumber !== "number" || resourceNumber === 0) {
      console.warn(
        `[benchmark] warn: fixture resource '${resource}' has no valid .number for scenario '${scenario.id}' — skipping reset`,
      )
      continue
    }

    try {
      entry.fn(manifest.repo.full_name, resourceNumber, reviewerToken ?? "")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        `[benchmark] warn: reset of '${resource}' for scenario '${scenario.id}' failed: ${message} — continuing`,
      )
    }
  }
}
