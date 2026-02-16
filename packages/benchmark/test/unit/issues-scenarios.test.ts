import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("roadmap issues benchmark scenarios", () => {
  it("adds issues set without mutating default set", async () => {
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
      "pr-list-open-001",
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
      "issue-blocked-by-remove-001",
    ])
  })
})
