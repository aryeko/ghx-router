import {
  OPERATION_BUILDERS,
  type OperationBuilder,
  replyBuilder,
  resolveBuilder,
  unresolveBuilder,
} from "@core/gql/builders.js"
import { describe, expect, it } from "vitest"

function expectBuilder(capabilityId: string): OperationBuilder {
  const builder = OPERATION_BUILDERS[capabilityId]
  expect(builder).toBeDefined()
  if (!builder) {
    throw new Error(`Missing builder for ${capabilityId}`)
  }
  return builder
}

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
    const raw = { comment: { id: "c1" } }
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
    const raw = { thread: { id: "t1", isResolved: true } }
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
    const raw = { thread: { id: "t1", isResolved: false } }
    const result = unresolveBuilder.mapResponse(raw)
    expect(result).toEqual({ id: "t1", isResolved: false })
  })
})

describe("issue builders", () => {
  it("issue.update requires issueId and at least one update field", () => {
    const builder = expectBuilder("issue.update")
    expect(() => builder.build({ issueId: "i1" })).toThrow(
      "issue.update requires at least one field",
    )
    expect(() => builder.build({ body: "Body only" })).toThrow("issueId is required")

    const built = builder.build({ issueId: "i1", title: "New", body: "Body" })
    expect(built.variables).toEqual({
      issueId: "i1",
      title: "New",
      body: "Body",
    })
  })

  it("issue.update maps response and rejects malformed payload", () => {
    const builder = expectBuilder("issue.update")

    expect(() => builder.mapResponse({ issue: { id: "i1" } })).toThrow("Issue update failed")

    const mapped = builder.mapResponse({
      issue: {
        id: "i1",
        number: 7,
        title: "T",
        state: "OPEN",
        url: "https://example.com",
      },
    })
    expect(mapped).toEqual({
      id: "i1",
      number: 7,
      title: "T",
      state: "OPEN",
      url: "https://example.com",
    })
  })

  it("issue.labels.update validates label ids and maps names", () => {
    const builder = expectBuilder("issue.labels.update")
    expect(() => builder.build({ issueId: "i1", labelIds: [1] })).toThrow(
      "labelIds (or labels) must be an array of strings",
    )

    const built = builder.build({ issueId: "i1", labelIds: ["l1", "l2"] })
    expect(built.variables).toEqual({ issueId: "i1", labelIds: ["l1", "l2"] })

    expect(() => builder.mapResponse({ issue: {} })).toThrow("Issue labels update failed")

    const mapped = builder.mapResponse({
      issue: { id: "i1", labels: { nodes: [{ name: "bug" }, { name: 42 }] } },
    })
    expect(mapped).toEqual({ issueId: "i1", labels: ["bug"] })
  })

  it("issue.assignees.update validates ids and maps logins", () => {
    const builder = expectBuilder("issue.assignees.update")
    expect(() => builder.build({ issueId: "i1", assigneeIds: [true] })).toThrow(
      "assigneeIds (or assignees) must be an array of strings",
    )

    const built = builder.build({ issueId: "i1", assigneeIds: ["u1"] })
    expect(built.variables).toEqual({ issueId: "i1", assigneeIds: ["u1"] })

    expect(() => builder.mapResponse({ issue: {} })).toThrow("Issue assignees update failed")

    const mapped = builder.mapResponse({
      issue: { id: "i1", assignees: { nodes: [{ login: "octocat" }, { login: 10 }] } },
    })
    expect(mapped).toEqual({ issueId: "i1", assignees: ["octocat"] })
  })

  it("issue.milestone.set validates milestone id and maps nullable milestone", () => {
    const builder = expectBuilder("issue.milestone.set")
    expect(() => builder.build({ issueId: "i1", milestoneId: 1 })).toThrow(
      "milestoneId (or milestoneNumber) must be a string or null",
    )

    const built = builder.build({ issueId: "i1", milestoneId: null })
    expect(built.variables).toEqual({ issueId: "i1", milestoneId: null })

    expect(() => builder.mapResponse({ issue: {} })).toThrow("Issue milestone update failed")

    const mapped = builder.mapResponse({
      issue: { id: "i1", milestone: { number: 12 } },
    })
    expect(mapped).toEqual({ issueId: "i1", milestoneNumber: 12 })
  })

  it("issue.comments.create validates input and maps response", () => {
    const builder = expectBuilder("issue.comments.create")
    expect(() => builder.build({ issueId: "" })).toThrow("issueId is required")
    expect(() => builder.build({ issueId: "i1", body: "" })).toThrow("body is required")

    const built = builder.build({ issueId: "i1", body: "hello" })
    expect(built.variables).toEqual({ issueId: "i1", body: "hello" })

    expect(() => builder.mapResponse({ commentEdge: { node: { id: "c1" } } })).toThrow(
      "Issue comment creation failed",
    )

    const mapped = builder.mapResponse({
      commentEdge: { node: { id: "c1", body: "hello", url: "https://example.com/c1" } },
    })
    expect(mapped).toEqual({
      commentId: "c1",
      body: "hello",
      url: "https://example.com/c1",
    })
  })
})
