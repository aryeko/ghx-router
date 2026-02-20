import {
  getCliHandler,
  listCliCapabilities,
} from "@core/core/execution/adapters/cli/capability-registry.js"
import { describe, expect, it } from "vitest"

const ALL_CLI_CAPABILITY_IDS = [
  // repo
  "repo.view",
  "repo.labels.list",
  "repo.issue_types.list",
  // issue
  "issue.view",
  "issue.list",
  "issue.comments.list",
  "issue.labels.remove",
  "issue.assignees.add",
  "issue.assignees.remove",
  "issue.milestone.clear",
  // pr
  "pr.view",
  "pr.list",
  "pr.create",
  "pr.update",
  "pr.checks.list",
  "pr.checks.rerun.failed",
  "pr.checks.rerun.all",
  "pr.merge.status",
  "pr.reviews.submit",
  "pr.merge",
  "pr.reviews.request",
  "pr.assignees.add",
  "pr.assignees.remove",
  "pr.branch.update",
  "pr.diff.view",
  "pr.diff.files",
  // workflow
  "workflow.runs.list",
  "workflow.job.logs.raw",
  "workflow.job.logs.view",
  "workflow.list",
  "workflow.view",
  "workflow.run.view",
  "workflow.run.rerun.all",
  "workflow.run.cancel",
  "workflow.run.artifacts.list",
  "workflow.dispatch",
  "workflow.run.rerun.failed",
  // project-v2
  "project_v2.org.view",
  "project_v2.user.view",
  "project_v2.fields.list",
  "project_v2.items.list",
  "project_v2.items.issue.add",
  "project_v2.items.issue.remove",
  "project_v2.items.field.update",
  // release
  "release.list",
  "release.view",
  "release.create",
  "release.update",
  "release.publish",
] as const

describe("getCliHandler", () => {
  it("returns undefined for an unknown capability", () => {
    expect(getCliHandler("unknown.capability")).toBeUndefined()
  })

  it.each(ALL_CLI_CAPABILITY_IDS)("returns a handler for %s", (capabilityId) => {
    expect(getCliHandler(capabilityId)).toBeDefined()
  })
})

describe("listCliCapabilities", () => {
  it(`lists all ${ALL_CLI_CAPABILITY_IDS.length} registered capability IDs`, () => {
    expect(listCliCapabilities()).toHaveLength(ALL_CLI_CAPABILITY_IDS.length)
  })

  it("includes all expected capability IDs", () => {
    const listed = listCliCapabilities()
    for (const id of ALL_CLI_CAPABILITY_IDS) {
      expect(listed).toContain(id)
    }
  })
})
