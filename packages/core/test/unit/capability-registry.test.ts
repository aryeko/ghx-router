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
        task: "issue.labels.set",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.labels.add",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.labels.remove",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "issue.assignees.set",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.assignees.add",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "issue.assignees.remove",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "issue.milestone.set",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.milestone.clear",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "issue.comments.create",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.relations.prs.list",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.relations.view",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.relations.parent.set",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.relations.parent.remove",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.relations.blocked_by.add",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.relations.blocked_by.remove",
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
        task: "pr.threads.list",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.threads.reply",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.threads.resolve",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.threads.unresolve",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.reviews.list",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.reviews.request",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.reviews.submit",
        defaultRoute: "graphql",
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
        task: "pr.checks.rerun.failed",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.checks.rerun.all",
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
        task: "pr.assignees.add",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.assignees.remove",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.branch.update",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.view",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.org.view",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.user.view",
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
        task: "project_v2.items.issue.add",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.items.issue.remove",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.items.field.update",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.view",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.create",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.update",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.publish",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.dispatch",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.job.logs.view",
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
        task: "workflow.run.rerun.all",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.run.rerun.failed",
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
