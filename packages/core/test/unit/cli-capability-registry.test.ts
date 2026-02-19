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
  // pr
  "pr.view",
  "pr.list",
  "pr.create",
  "pr.update",
  "pr.checks.list",
  "pr.checks.failed",
  "pr.merge.status",
  "pr.review.submit",
  "pr.merge",
  "pr.checks.rerun_failed",
  "pr.checks.rerun_all",
  "pr.review.request",
  "pr.assignees.update",
  "pr.branch.update",
  "pr.diff.view",
  "pr.diff.files",
  "check_run.annotations.list",
  // workflow
  "workflow.runs.list",
  "workflow.job.logs.raw",
  "workflow.job.logs.get",
  "workflow.list",
  "workflow.get",
  "workflow.run.view",
  "workflow.run.rerun_all",
  "workflow.run.cancel",
  "workflow.run.artifacts.list",
  "workflow.dispatch.run",
  "workflow.run.rerun_failed",
  // project-v2
  "project_v2.org.get",
  "project_v2.user.get",
  "project_v2.fields.list",
  "project_v2.items.list",
  "project_v2.item.add_issue",
  "project_v2.item.field.update",
  // release
  "release.list",
  "release.get",
  "release.create_draft",
  "release.update",
  "release.publish_draft",
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
