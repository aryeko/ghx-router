import type { Scenario } from "../../domain/types.js"
import { ghOk } from "./ghx-router-preflight.js"

export function validateFixture(
  scenario: Scenario,
  ghOkFn: (args: string[]) => boolean = ghOk,
): void {
  const repo = scenario.fixture?.repo
  if (!repo) return

  if (!ghOkFn(["repo", "view", repo, "--json", "name"])) {
    throw new Error(`fixture_invalid: repo not found or inaccessible: ${repo}`)
  }

  if (scenario.task === "issue.view") {
    const issueNumber =
      typeof scenario.input.issueNumber === "number"
        ? scenario.input.issueNumber
        : scenario.input.issue_number
    if (typeof issueNumber !== "number") {
      throw new Error("fixture_invalid: issue.view requires numeric input.issueNumber")
    }
    if (!ghOkFn(["issue", "view", String(issueNumber), "--repo", repo, "--json", "number"])) {
      throw new Error(`fixture_invalid: issue #${issueNumber} not found in ${repo}`)
    }
  }

  if (scenario.task === "pr.view") {
    const prNumber =
      typeof scenario.input.prNumber === "number"
        ? scenario.input.prNumber
        : scenario.input.pr_number
    if (typeof prNumber !== "number") {
      throw new Error("fixture_invalid: pr.view requires numeric input.prNumber")
    }
    if (!ghOkFn(["pr", "view", String(prNumber), "--repo", repo, "--json", "number"])) {
      throw new Error(`fixture_invalid: pr #${prNumber} not found in ${repo}`)
    }
  }
}
