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

  it("includes roadmap batch C release and delivery set", () => {
    const scenarioSets = loadScenarioSets()

    expect(scenarioSets["roadmap-batch-c-release-delivery"]).toEqual([
      "batch-c-release-list-001",
      "batch-c-release-get-001",
      "batch-c-release-create-draft-001",
      "batch-c-release-update-001",
      "batch-c-release-publish-draft-001",
      "batch-c-workflow-dispatch-run-001",
      "batch-c-workflow-run-rerun-failed-001"
    ])
  })

  it("includes roadmap batch A and B sets", () => {
    const scenarioSets = loadScenarioSets()

    expect(scenarioSets["roadmap-batch-a-pr-exec"]).toEqual([
      "batch-a-pr-review-submit-approve-001",
      "batch-a-pr-review-submit-request-changes-001",
      "batch-a-pr-review-submit-comment-001",
      "batch-a-pr-merge-execute-001",
      "batch-a-pr-checks-rerun-failed-001",
      "batch-a-pr-checks-rerun-all-001",
      "batch-a-pr-reviewers-request-001",
      "batch-a-pr-assignees-update-001",
      "batch-a-pr-branch-update-001"
    ])

    expect(scenarioSets["roadmap-batch-b-issues"]).toEqual([
      "batch-b-issue-create-001",
      "batch-b-issue-update-001",
      "batch-b-issue-close-001",
      "batch-b-issue-reopen-001",
      "batch-b-issue-delete-001",
      "batch-b-issue-labels-update-001",
      "batch-b-issue-assignees-update-001",
      "batch-b-issue-milestone-set-001",
      "batch-b-issue-comments-create-001",
      "batch-b-issue-linked-prs-list-001",
      "batch-b-issue-relations-get-001",
      "batch-b-issue-parent-set-001",
      "batch-b-issue-parent-remove-001",
      "batch-b-issue-blocked-by-add-001",
      "batch-b-issue-blocked-by-remove-001"
    ])
  })

  it("defines roadmap-all as exact union of roadmap A-D sets", () => {
    const scenarioSets = loadScenarioSets()

    const expectedUnion = new Set([
      ...(scenarioSets["roadmap-batch-a-pr-exec"] ?? []),
      ...(scenarioSets["roadmap-batch-b-issues"] ?? []),
      ...(scenarioSets["roadmap-batch-c-release-delivery"] ?? []),
      ...(scenarioSets["roadmap-batch-d-workflow-projects-v2"] ?? [])
    ])

    expect(new Set(scenarioSets["roadmap-all"] ?? [])).toEqual(expectedUnion)
  })
})
