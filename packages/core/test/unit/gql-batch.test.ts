import { describe, expect, it } from "vitest"
import { buildBatchMutation } from "../../src/gql/batch.js"

describe("buildBatchMutation", () => {
  const REPLY_MUTATION = `
    mutation PrCommentReply($threadId: ID!, $body: String!) {
      addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
        comment { id }
      }
    }
  `

  const RESOLVE_MUTATION = `
    mutation PrCommentResolve($threadId: ID!) {
      resolveReviewThread(input: { threadId: $threadId }) {
        thread { id isResolved }
      }
    }
  `

  it("combines two operations with aliases and prefixed variables", () => {
    const result = buildBatchMutation([
      {
        alias: "reply0",
        mutation: REPLY_MUTATION,
        variables: { threadId: "t1", body: "Fixed" },
      },
      {
        alias: "resolve0",
        mutation: RESOLVE_MUTATION,
        variables: { threadId: "t1" },
      },
    ])

    // Check merged variables are prefixed
    expect(result.variables).toEqual({
      reply0_threadId: "t1",
      reply0_body: "Fixed",
      resolve0_threadId: "t1",
    })

    // Check document contains aliased selections
    expect(result.document).toContain("reply0: addPullRequestReviewThreadReply")
    expect(result.document).toContain("resolve0: resolveReviewThread")

    // Check variable references are prefixed
    expect(result.document).toContain("$reply0_threadId")
    expect(result.document).toContain("$reply0_body")
    expect(result.document).toContain("$resolve0_threadId")

    // Check it's a single mutation
    expect(result.document).toMatch(/^mutation BatchComposite\(/)
  })

  it("handles single operation", () => {
    const result = buildBatchMutation([
      {
        alias: "op0",
        mutation: RESOLVE_MUTATION,
        variables: { threadId: "t1" },
      },
    ])
    expect(result.variables).toEqual({ op0_threadId: "t1" })
    expect(result.document).toContain("op0: resolveReviewThread")
  })

  it("throws on empty operations array", () => {
    expect(() => buildBatchMutation([])).toThrow()
  })

  it("preserves selection set structure (nested fields)", () => {
    const result = buildBatchMutation([
      {
        alias: "r0",
        mutation: RESOLVE_MUTATION,
        variables: { threadId: "t1" },
      },
    ])
    expect(result.document).toContain("thread { id isResolved }")
    // or at minimum contains "thread" and "isResolved"
    expect(result.document).toContain("thread")
    expect(result.document).toContain("isResolved")
  })

  it("handles multiple operations of the same type with different aliases", () => {
    const result = buildBatchMutation([
      { alias: "resolve0", mutation: RESOLVE_MUTATION, variables: { threadId: "t1" } },
      { alias: "resolve1", mutation: RESOLVE_MUTATION, variables: { threadId: "t2" } },
      { alias: "resolve2", mutation: RESOLVE_MUTATION, variables: { threadId: "t3" } },
    ])

    expect(result.variables).toEqual({
      resolve0_threadId: "t1",
      resolve1_threadId: "t2",
      resolve2_threadId: "t3",
    })
    expect(result.document).toContain("resolve0: resolveReviewThread")
    expect(result.document).toContain("resolve1: resolveReviewThread")
    expect(result.document).toContain("resolve2: resolveReviewThread")
  })
})
