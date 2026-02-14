import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

function loadScenarioSets(): Record<string, string[]> {
  const manifestPath = resolve(__dirname, "../../scenario-sets.json")
  return JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, string[]>
}

describe("scenario-sets manifest", () => {
  it("keeps default benchmark set stable and mutation-free", () => {
    const scenarioSets = loadScenarioSets()

    expect(scenarioSets.default).toEqual([
      "repo-view-001",
      "issue-view-001",
      "issue-list-open-001",
      "issue-comments-list-001",
      "pr-view-001",
      "pr-list-open-001"
    ])
  })

  it("defines roadmap batch D workflow and projects v2 set", () => {
    const scenarioSets = loadScenarioSets()

    expect(scenarioSets["roadmap-batch-d-workflow-projects-v2"]).toEqual([
      "batch-d-workflow-list-001",
      "batch-d-workflow-get-001",
      "batch-d-workflow-run-get-001",
      "batch-d-workflow-run-rerun-all-001",
      "batch-d-workflow-run-cancel-001",
      "batch-d-workflow-run-artifacts-list-001",
      "batch-d-project-v2-org-get-001",
      "batch-d-project-v2-user-get-001",
      "batch-d-project-v2-fields-list-001",
      "batch-d-project-v2-items-list-001",
      "batch-d-project-v2-item-add-issue-001",
      "batch-d-project-v2-item-field-update-001",
      "batch-d-repo-labels-list-001",
      "batch-d-repo-issue-types-list-001"
    ])
  })
})
