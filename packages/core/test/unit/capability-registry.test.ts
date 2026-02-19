import { capabilityRegistry } from "@core/core/routing/capability-registry.js"
import { describe, expect, it } from "vitest"

describe("capabilityRegistry", () => {
  it("is generated from operation cards with deterministic route order", () => {
    expect(capabilityRegistry).toEqual([
      {
        task: "repo.view",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"],
      },
      {
        task: "repo.labels.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "repo.issue_types.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "issue.view",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"],
      },
      {
        task: "issue.list",
        defaultRoute: "cli",
        fallbackRoutes: ["graphql"],
      },
      {
        task: "issue.comments.list",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"],
      },
      {
        task: "issue.create",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.update",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.close",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.reopen",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.delete",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.labels.update",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.labels.add",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.assignees.update",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.milestone.set",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.comments.create",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.linked_prs.list",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.relations.get",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.parent.set",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.parent.remove",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.blocked_by.add",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.blocked_by.remove",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.view",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"],
      },
      {
        task: "pr.list",
        defaultRoute: "cli",
        fallbackRoutes: ["graphql"],
      },
      {
        task: "pr.create",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.update",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.thread.list",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.thread.reply",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.thread.resolve",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.thread.unresolve",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.review.list",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.review.request",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.review.submit",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.diff.files",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.diff.view",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.checks.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.checks.failed",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.checks.rerun_failed",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.checks.rerun_all",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.merge.status",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"],
      },
      {
        task: "pr.merge",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.assignees.update",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.branch.update",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "check_run.annotations.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.get",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.org.get",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.user.get",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.fields.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.items.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.item.add_issue",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.item.field.update",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.get",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.create_draft",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.update",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.publish_draft",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.dispatch.run",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.job.logs.get",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.job.logs.raw",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.run.artifacts.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.run.cancel",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },

      {
        task: "workflow.run.rerun_all",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.run.rerun_failed",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.run.view",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.runs.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
    ])
  })
})
