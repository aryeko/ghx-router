import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("roadmap batch b benchmark scenarios", () => {
  it("adds roadmap-batch-b-issues set without mutating default set", async () => {
    const benchmarkRoot = process.cwd()
    const scenarioSetsPath = `${benchmarkRoot}/scenario-sets.json`
    const raw = await readFile(scenarioSetsPath, "utf8")
    const scenarioSets = JSON.parse(raw) as Record<string, string[]>

    expect(scenarioSets.default).toEqual([
      "repo-view-001",
      "issue-view-001",
      "issue-list-open-001",
      "issue-comments-list-001",
      "pr-view-001",
      "pr-list-open-001"
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
})
