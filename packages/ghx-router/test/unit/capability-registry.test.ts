import { describe, expect, it } from "vitest"

import { capabilityRegistry } from "../../src/core/routing/capability-registry.js"

describe("capabilityRegistry", () => {
  it("is generated from operation cards with deterministic route order", () => {
    expect(capabilityRegistry).toEqual([
      {
        task: "repo.view",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"]
      },
      {
        task: "issue.view",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"]
      },
      {
        task: "issue.list",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"]
      },
      {
        task: "issue.comments.list",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"]
      },
      {
        task: "pr.view",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"]
      },
      {
        task: "pr.list",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"]
      }
    ])
  })
})
