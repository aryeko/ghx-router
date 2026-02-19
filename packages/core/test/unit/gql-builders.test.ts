import { describe, expect, it } from "vitest"
import {
  replyBuilder,
  resolveBuilder,
  unresolveBuilder,
} from "../../src/gql/builders.js"

describe("OperationBuilder exports", () => {
  it("exports replyBuilder", () => {
    expect(replyBuilder).toBeDefined()
    expect(replyBuilder.build).toBeDefined()
    expect(replyBuilder.mapResponse).toBeDefined()
  })

  it("exports resolveBuilder", () => {
    expect(resolveBuilder).toBeDefined()
    expect(resolveBuilder.build).toBeDefined()
    expect(resolveBuilder.mapResponse).toBeDefined()
  })

  it("exports unresolveBuilder", () => {
    expect(unresolveBuilder).toBeDefined()
    expect(unresolveBuilder.build).toBeDefined()
    expect(unresolveBuilder.mapResponse).toBeDefined()
  })
})

describe("pr.thread.reply builder", () => {
  it("build() returns mutation string and variables", () => {
    const result = replyBuilder.build({ threadId: "t1", body: "Fixed" })
    expect(result.mutation).toContain("addPullRequestReviewThreadReply")
    expect(result.variables).toEqual({ threadId: "t1", body: "Fixed" })
  })

  it("build() throws when body is missing", () => {
    expect(() => replyBuilder.build({ threadId: "t1" })).toThrow()
  })

  it("mapResponse() extracts comment id", () => {
    const raw = {
      addPullRequestReviewThreadReply: { comment: { id: "c1" } },
    }
    const result = replyBuilder.mapResponse(raw)
    expect(result).toEqual({ id: "c1" })
  })
})

describe("pr.thread.resolve builder", () => {
  it("build() returns mutation string and variables", () => {
    const result = resolveBuilder.build({ threadId: "t1" })
    expect(result.mutation).toContain("resolveReviewThread")
    expect(result.variables).toEqual({ threadId: "t1" })
  })

  it("mapResponse() extracts thread state", () => {
    const raw = {
      resolveReviewThread: { thread: { id: "t1", isResolved: true } },
    }
    const result = resolveBuilder.mapResponse(raw)
    expect(result).toEqual({ id: "t1", isResolved: true })
  })
})

describe("pr.thread.unresolve builder", () => {
  it("build() returns mutation string and variables", () => {
    const result = unresolveBuilder.build({ threadId: "t1" })
    expect(result.mutation).toContain("unresolveReviewThread")
    expect(result.variables).toEqual({ threadId: "t1" })
  })

  it("mapResponse() extracts thread state", () => {
    const raw = {
      unresolveReviewThread: { thread: { id: "t1", isResolved: false } },
    }
    const result = unresolveBuilder.mapResponse(raw)
    expect(result).toEqual({ id: "t1", isResolved: false })
  })
})
