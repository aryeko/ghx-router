import { getLookupDocument, getMutationDocument } from "@core/gql/document-registry.js"
import { describe, expect, it } from "vitest"

describe("document-registry – mutations", () => {
  it("IssueAssigneesAdd", () => {
    expect(getMutationDocument("IssueAssigneesAdd")).toContain("mutation IssueAssigneesAdd")
  })

  it("IssueAssigneesRemove", () => {
    expect(getMutationDocument("IssueAssigneesRemove")).toContain("mutation IssueAssigneesRemove")
  })

  it("IssueAssigneesUpdate", () => {
    expect(getMutationDocument("IssueAssigneesUpdate")).toContain("mutation IssueAssigneesUpdate")
  })

  it("IssueBlockedByAdd", () => {
    expect(getMutationDocument("IssueBlockedByAdd")).toContain("mutation IssueBlockedByAdd")
  })

  it("IssueBlockedByRemove", () => {
    expect(getMutationDocument("IssueBlockedByRemove")).toContain("mutation IssueBlockedByRemove")
  })

  it("IssueClose", () => {
    expect(getMutationDocument("IssueClose")).toContain("mutation IssueClose")
  })

  it("IssueCommentCreate", () => {
    expect(getMutationDocument("IssueCommentCreate")).toContain("mutation IssueCommentCreate")
  })

  it("IssueCreate", () => {
    expect(getMutationDocument("IssueCreate")).toContain("mutation IssueCreate")
  })

  it("IssueDelete", () => {
    expect(getMutationDocument("IssueDelete")).toContain("mutation IssueDelete")
  })

  it("IssueLabelsAdd", () => {
    expect(getMutationDocument("IssueLabelsAdd")).toContain("mutation IssueLabelsAdd")
  })

  it("IssueLabelsRemove", () => {
    expect(getMutationDocument("IssueLabelsRemove")).toContain("mutation IssueLabelsRemove")
  })

  it("IssueLabelsUpdate", () => {
    expect(getMutationDocument("IssueLabelsUpdate")).toContain("mutation IssueLabelsUpdate")
  })

  it("IssueMilestoneSet", () => {
    expect(getMutationDocument("IssueMilestoneSet")).toContain("mutation IssueMilestoneSet")
  })

  it("IssueParentRemove", () => {
    expect(getMutationDocument("IssueParentRemove")).toContain("mutation IssueParentRemove")
  })

  it("IssueParentSet", () => {
    expect(getMutationDocument("IssueParentSet")).toContain("mutation IssueParentSet")
  })

  it("IssueReopen", () => {
    expect(getMutationDocument("IssueReopen")).toContain("mutation IssueReopen")
  })

  it("IssueUpdate", () => {
    expect(getMutationDocument("IssueUpdate")).toContain("mutation IssueUpdate")
  })

  it("PrCommentReply", () => {
    expect(getMutationDocument("PrCommentReply")).toContain("mutation PrCommentReply")
  })

  it("PrCommentResolve", () => {
    expect(getMutationDocument("PrCommentResolve")).toContain("mutation PrCommentResolve")
  })

  it("PrCommentUnresolve", () => {
    expect(getMutationDocument("PrCommentUnresolve")).toContain("mutation PrCommentUnresolve")
  })

  it("PrReviewSubmit", () => {
    expect(getMutationDocument("PrReviewSubmit")).toContain("mutation PrReviewSubmit")
  })

  it("throws on unknown mutation", () => {
    expect(() => getMutationDocument("NonExistentMutation")).toThrow()
  })
})

describe("document-registry – lookups", () => {
  it("IssueAssigneesLookup", () => {
    expect(getLookupDocument("IssueAssigneesLookup")).toContain("query IssueAssigneesLookup")
  })

  it("IssueAssigneesLookupByNumber", () => {
    expect(getLookupDocument("IssueAssigneesLookupByNumber")).toContain(
      "query IssueAssigneesLookupByNumber",
    )
  })

  it("IssueCreateRepositoryId", () => {
    expect(getLookupDocument("IssueCreateRepositoryId")).toContain("query IssueCreateRepositoryId")
  })

  it("IssueLabelsLookup", () => {
    expect(getLookupDocument("IssueLabelsLookup")).toContain("query IssueLabelsLookup")
  })

  it("IssueLabelsLookupByNumber", () => {
    expect(getLookupDocument("IssueLabelsLookupByNumber")).toContain(
      "query IssueLabelsLookupByNumber",
    )
  })

  it("IssueMilestoneLookup", () => {
    expect(getLookupDocument("IssueMilestoneLookup")).toContain("query IssueMilestoneLookup")
  })

  it("IssueNodeIdLookup", () => {
    expect(getLookupDocument("IssueNodeIdLookup")).toContain("query IssueNodeIdLookup")
  })

  it("IssueParentLookup", () => {
    expect(getLookupDocument("IssueParentLookup")).toContain("query IssueParentLookup")
  })

  it("PrNodeId", () => {
    expect(getLookupDocument("PrNodeId")).toContain("query PrNodeId")
  })

  it("throws on unknown lookup", () => {
    expect(() => getLookupDocument("NonExistentLookup")).toThrow()
  })
})
