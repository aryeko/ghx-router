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

  it("defines workflows and projects-v2 sets", () => {
    const scenarioSets = loadScenarioSets()

    expect(scenarioSets.workflows).toEqual([
      "workflow-dispatch-run-001",
      "workflow-run-rerun-failed-001",
      "workflow-list-001",
      "workflow-get-001",
      "workflow-run-get-001",
      "workflow-run-rerun-all-001",
      "workflow-run-cancel-001",
      "workflow-run-artifacts-list-001"
    ])

    expect(scenarioSets["projects-v2"]).toEqual([
      "project-v2-org-get-001",
      "project-v2-user-get-001",
      "project-v2-fields-list-001",
      "project-v2-items-list-001",
      "project-v2-item-add-issue-001",
      "project-v2-item-field-update-001",
      "repo-labels-list-001",
      "repo-issue-types-list-001"
    ])
  })

  it("includes roadmap batch C release and delivery set", () => {
    const scenarioSets = loadScenarioSets()

    expect(scenarioSets["release-delivery"]).toEqual([
      "release-list-001",
      "release-get-001",
      "release-create-draft-001",
      "release-update-001",
      "release-publish-draft-001"
    ])
  })

  it("includes roadmap batch A and B sets", () => {
    const scenarioSets = loadScenarioSets()

    expect(scenarioSets["pr-exec"]).toEqual([
      "pr-review-submit-approve-001",
      "pr-review-submit-request-changes-001",
      "pr-review-submit-comment-001",
      "pr-checks-rerun-failed-001",
      "pr-checks-rerun-all-001",
      "pr-reviewers-request-001",
      "pr-assignees-update-001",
      "pr-branch-update-001",
      "pr-merge-execute-001"
    ])

    expect(scenarioSets["issues"]).toEqual([
      "issue-create-001",
      "issue-update-001",
      "issue-close-001",
      "issue-reopen-001",
      "issue-delete-001",
      "issue-labels-update-001",
      "issue-assignees-update-001",
      "issue-milestone-set-001",
      "issue-comments-create-001",
      "issue-linked-prs-list-001",
      "issue-relations-get-001",
      "issue-parent-set-001",
      "issue-parent-remove-001",
      "issue-blocked-by-add-001",
      "issue-blocked-by-remove-001"
    ])
  })

  it("defines ci-verify-pr for low-noise PR gating", () => {
    const scenarioSets = loadScenarioSets()

    expect(scenarioSets["ci-verify-pr"]).toEqual([
      "pr-status-checks-001",
      "pr-checks-get-failed-001"
    ])
  })

  it("defines ci-verify-release for stable release gating", () => {
    const scenarioSets = loadScenarioSets()

    expect(scenarioSets["ci-verify-release"]).toEqual([
      "repo-view-001",
      "workflow-runs-list-001",
      "workflow-run-jobs-list-001",
      "release-list-001",
      "pr-mergeability-view-001"
    ])
  })

  it("defines full-seeded as full roadmap mutation-capable coverage", () => {
    const scenarioSets = loadScenarioSets()

    expect(new Set(scenarioSets["full-seeded"] ?? [])).toEqual(new Set(scenarioSets["all"] ?? []))
  })

  it("defines all as exact union of roadmap A-D sets", () => {
    const scenarioSets = loadScenarioSets()

    const expectedUnion = new Set([
      ...(scenarioSets["pr-exec"] ?? []),
      ...(scenarioSets["issues"] ?? []),
      ...(scenarioSets["release-delivery"] ?? []),
      ...(scenarioSets.workflows ?? []),
      ...(scenarioSets["projects-v2"] ?? [])
    ])

    expect(new Set(scenarioSets.all ?? [])).toEqual(expectedUnion)
  })

  it("keeps pr-operations-all scoped to PR capabilities only", () => {
    const scenarioSets = loadScenarioSets()

    expect(scenarioSets["pr-operations-all"]).toEqual([
      "pr-comments-unresolved-001",
      "pr-reviews-list-001",
      "pr-diff-list-files-001",
      "pr-status-checks-001",
      "pr-checks-get-failed-001",
      "pr-mergeability-view-001",
      "pr-comment-reply-001",
      "pr-comment-resolve-001",
      "pr-comment-unresolve-001",
      "pr-ready-for-review-set-001",
      "pr-review-submit-approve-001",
      "pr-review-submit-request-changes-001",
      "pr-review-submit-comment-001",
      "pr-checks-rerun-failed-001",
      "pr-checks-rerun-all-001",
      "pr-reviewers-request-001",
      "pr-assignees-update-001",
      "pr-branch-update-001",
      "pr-merge-execute-001",
      "pr-view-001",
      "pr-list-open-001"
    ])
  })
})
