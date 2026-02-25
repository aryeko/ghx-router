import type { InjectSpec } from "@core/core/registry/types.js"
import { applyInject, buildOperationVars } from "@core/gql/resolve.js"
import { describe, expect, it } from "vitest"

describe("pr.reviews.submit resolution inject-path validation", () => {
  const prNodeIdInjectSpec: InjectSpec = {
    target: "pullRequestId",
    source: "scalar",
    path: "repository.pullRequest.id",
  }

  it("extracts pullRequestId from PrNodeId lookup response", () => {
    const lookupResult = {
      repository: {
        pullRequest: { id: "PR_kwDOTest1234" },
      },
    }
    const result = applyInject(prNodeIdInjectSpec, lookupResult, {})
    expect(result).toEqual({ pullRequestId: "PR_kwDOTest1234" })
  })

  it("throws when pullRequest is null (PR not found)", () => {
    const lookupResult = {
      repository: {
        pullRequest: null,
      },
    }
    expect(() => applyInject(prNodeIdInjectSpec, lookupResult, {})).toThrow(/no value at path/)
  })

  it("throws when repository is null", () => {
    const lookupResult = { repository: null }
    expect(() => applyInject(prNodeIdInjectSpec, lookupResult, {})).toThrow(/no value at path/)
  })

  it("buildOperationVars produces correct variables for PrReviewSubmit", () => {
    const mutDoc = [
      "mutation PrReviewSubmit(",
      "  $pullRequestId: ID!",
      "  $event: PullRequestReviewEvent!",
      "  $body: String",
      "  $threads: [DraftPullRequestReviewThread!]",
      ") {",
      "  addPullRequestReview(input: {",
      "    pullRequestId: $pullRequestId",
      "    event: $event",
      "    body: $body",
      "    threads: $threads",
      "  }) {",
      "    pullRequestReview { id state url body }",
      "  }",
      "}",
    ].join("\n")

    const input = {
      owner: "acme",
      name: "repo",
      prNumber: 42,
      event: "APPROVE",
      body: "LGTM",
    }
    const resolved = { pullRequestId: "PR_kwDOTest1234" }

    const vars = buildOperationVars(mutDoc, input, resolved)

    // Must include mutation vars
    expect(vars).toHaveProperty("pullRequestId", "PR_kwDOTest1234")
    expect(vars).toHaveProperty("event", "APPROVE")
    expect(vars).toHaveProperty("body", "LGTM")

    // Must NOT include lookup-only vars (not in mutation signature)
    expect(vars).not.toHaveProperty("owner")
    expect(vars).not.toHaveProperty("name")
    expect(vars).not.toHaveProperty("prNumber")
  })
})
