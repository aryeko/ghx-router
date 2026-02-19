import { describe, expect, it } from "vitest"
import { OPERATION_BUILDERS } from "../../src/gql/builders.js"

describe("OperationBuilder registry", () => {
  it("has a builder for pr.thread.reply", () => {
    const builder = OPERATION_BUILDERS["pr.thread.reply"]
    expect(builder).toBeDefined()
  })

  it("has a builder for pr.thread.resolve", () => {
    const builder = OPERATION_BUILDERS["pr.thread.resolve"]
    expect(builder).toBeDefined()
  })

  it("has a builder for pr.thread.unresolve", () => {
    const builder = OPERATION_BUILDERS["pr.thread.unresolve"]
    expect(builder).toBeDefined()
  })
})

describe("pr.thread.reply builder", () => {
  it("build() returns mutation string and variables", () => {
    const builder = OPERATION_BUILDERS["pr.thread.reply"]
    if (!builder) {
      throw new Error("Builder not found")
    }
    const result = builder.build({ threadId: "t1", body: "Fixed" })
    expect(result.mutation).toContain("addPullRequestReviewThreadReply")
    expect(result.variables).toEqual({ threadId: "t1", body: "Fixed" })
  })

  it("build() throws when body is missing", () => {
    const builder = OPERATION_BUILDERS["pr.thread.reply"]
    if (!builder) {
      throw new Error("Builder not found")
    }
    expect(() => builder.build({ threadId: "t1" })).toThrow()
  })

  it("mapResponse() extracts comment id", () => {
    const builder = OPERATION_BUILDERS["pr.thread.reply"]
    if (!builder) {
      throw new Error("Builder not found")
    }
    const raw = {
      addPullRequestReviewThreadReply: { comment: { id: "c1" } },
    }
    const result = builder.mapResponse(raw)
    expect(result).toEqual({ id: "c1" })
  })
})

describe("pr.thread.resolve builder", () => {
  it("build() returns mutation string and variables", () => {
    const builder = OPERATION_BUILDERS["pr.thread.resolve"]
    if (!builder) {
      throw new Error("Builder not found")
    }
    const result = builder.build({ threadId: "t1" })
    expect(result.mutation).toContain("resolveReviewThread")
    expect(result.variables).toEqual({ threadId: "t1" })
  })

  it("mapResponse() extracts thread state", () => {
    const builder = OPERATION_BUILDERS["pr.thread.resolve"]
    if (!builder) {
      throw new Error("Builder not found")
    }
    const raw = {
      resolveReviewThread: { thread: { id: "t1", isResolved: true } },
    }
    const result = builder.mapResponse(raw)
    expect(result).toEqual({ id: "t1", isResolved: true })
  })
})

describe("pr.thread.unresolve builder", () => {
  it("build() returns mutation string and variables", () => {
    const builder = OPERATION_BUILDERS["pr.thread.unresolve"]
    if (!builder) {
      throw new Error("Builder not found")
    }
    const result = builder.build({ threadId: "t1" })
    expect(result.mutation).toContain("unresolveReviewThread")
    expect(result.variables).toEqual({ threadId: "t1" })
  })

  it("mapResponse() extracts thread state", () => {
    const builder = OPERATION_BUILDERS["pr.thread.unresolve"]
    if (!builder) {
      throw new Error("Builder not found")
    }
    const raw = {
      unresolveReviewThread: { thread: { id: "t1", isResolved: false } },
    }
    const result = builder.mapResponse(raw)
    expect(result).toEqual({ id: "t1", isResolved: false })
  })
})
