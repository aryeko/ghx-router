import { describe, expect, it } from "vitest"

import { capabilityRegistry } from "../../src/core/routing/capability-registry.js"

describe("capabilityRegistry", () => {
  it("is generated from operation cards with deterministic route order", () => {
    expect(capabilityRegistry).toEqual([
      {
        task: "repo.view",
        defaultRoute: "cli",
        fallbackRoutes: ["graphql"]
      },
      {
        task: "issue.view",
        defaultRoute: "cli",
        fallbackRoutes: ["graphql"]
      },
      {
        task: "issue.list",
        defaultRoute: "cli",
        fallbackRoutes: ["graphql"]
      },
      {
        task: "issue.comments.list",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"]
      },
      {
        task: "pr.view",
        defaultRoute: "cli",
        fallbackRoutes: ["graphql"]
      },
      {
        task: "pr.list",
        defaultRoute: "cli",
        fallbackRoutes: ["graphql"]
      }
    ])
  })
})
