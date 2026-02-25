import { getLookupDocument, getMutationDocument } from "@core/gql/document-registry.js"
import { describe, expect, it } from "vitest"

describe("document-registry – mutations", () => {
  it("returns document for IssueAssigneesAdd", () => {
    expect(getMutationDocument("IssueAssigneesAdd")).toContain("mutation IssueAssigneesAdd")
  })

  it("returns document for IssueAssigneesRemove", () => {
    expect(getMutationDocument("IssueAssigneesRemove")).toContain("mutation IssueAssigneesRemove")
  })

  it("returns document for IssueAssigneesUpdate", () => {
    expect(getMutationDocument("IssueAssigneesUpdate")).toContain("mutation IssueAssigneesUpdate")
  })

  it("returns document for IssueBlockedByAdd", () => {
    expect(getMutationDocument("IssueBlockedByAdd")).toContain("mutation IssueBlockedByAdd")
  })

  it("returns document for IssueBlockedByRemove", () => {
    expect(getMutationDocument("IssueBlockedByRemove")).toContain("mutation IssueBlockedByRemove")
  })

  it("returns document for IssueClose", () => {
    expect(getMutationDocument("IssueClose")).toContain("mutation IssueClose")
  })

  it("returns document for IssueCommentCreate", () => {
    expect(getMutationDocument("IssueCommentCreate")).toContain("mutation IssueCommentCreate")
  })

  it("returns document for IssueCreate", () => {
    expect(getMutationDocument("IssueCreate")).toContain("mutation IssueCreate")
  })

  it("returns document for IssueDelete", () => {
    expect(getMutationDocument("IssueDelete")).toContain("mutation IssueDelete")
  })

  it("returns document for IssueLabelsAdd", () => {
    expect(getMutationDocument("IssueLabelsAdd")).toContain("mutation IssueLabelsAdd")
  })

  it("returns document for IssueLabelsRemove", () => {
    expect(getMutationDocument("IssueLabelsRemove")).toContain("mutation IssueLabelsRemove")
  })

  it("returns document for IssueLabelsUpdate", () => {
    expect(getMutationDocument("IssueLabelsUpdate")).toContain("mutation IssueLabelsUpdate")
  })

  it("returns document for IssueMilestoneSet", () => {
    expect(getMutationDocument("IssueMilestoneSet")).toContain("mutation IssueMilestoneSet")
  })

  it("returns document for IssueParentRemove", () => {
    expect(getMutationDocument("IssueParentRemove")).toContain("mutation IssueParentRemove")
  })

  it("returns document for IssueParentSet", () => {
    expect(getMutationDocument("IssueParentSet")).toContain("mutation IssueParentSet")
  })

  it("returns document for IssueReopen", () => {
    expect(getMutationDocument("IssueReopen")).toContain("mutation IssueReopen")
  })

  it("returns document for IssueUpdate", () => {
    expect(getMutationDocument("IssueUpdate")).toContain("mutation IssueUpdate")
  })

  it("returns document for PrCommentReply", () => {
    expect(getMutationDocument("PrCommentReply")).toContain("mutation PrCommentReply")
  })

  it("returns document for PrCommentResolve", () => {
    expect(getMutationDocument("PrCommentResolve")).toContain("mutation PrCommentResolve")
  })

  it("returns document for PrCommentUnresolve", () => {
    expect(getMutationDocument("PrCommentUnresolve")).toContain("mutation PrCommentUnresolve")
  })

  it("returns document for PrReviewSubmit", () => {
    expect(getMutationDocument("PrReviewSubmit")).toContain("mutation PrReviewSubmit")
  })

  it("returns document for PrAssigneesAdd", () => {
    expect(getMutationDocument("PrAssigneesAdd")).toContain("mutation PrAssigneesAdd")
  })

  it("returns document for PrAssigneesRemove", () => {
    expect(getMutationDocument("PrAssigneesRemove")).toContain("mutation PrAssigneesRemove")
  })

  it("returns document for PrBranchUpdate", () => {
    expect(getMutationDocument("PrBranchUpdate")).toContain("mutation PrBranchUpdate")
  })

  it("returns document for PrCreate", () => {
    expect(getMutationDocument("PrCreate")).toContain("mutation PrCreate")
  })

  it("returns document for PrMerge", () => {
    expect(getMutationDocument("PrMerge")).toContain("mutation PrMerge")
  })

  it("returns document for PrReviewsRequest", () => {
    expect(getMutationDocument("PrReviewsRequest")).toContain("mutation PrReviewsRequest")
  })

  it("returns document for PrUpdate", () => {
    expect(getMutationDocument("PrUpdate")).toContain("mutation PrUpdate")
  })

  it("returns document for AddProjectV2Item", () => {
    expect(getMutationDocument("AddProjectV2Item")).toContain("mutation AddProjectV2Item")
  })

  it("returns document for RemoveProjectV2Item", () => {
    expect(getMutationDocument("RemoveProjectV2Item")).toContain("mutation RemoveProjectV2Item")
  })

  it("returns document for UpdateProjectV2ItemField", () => {
    expect(getMutationDocument("UpdateProjectV2ItemField")).toContain(
      "mutation UpdateProjectV2ItemField",
    )
  })

  it("throws on unknown mutation", () => {
    expect(() => getMutationDocument("NonExistentMutation")).toThrow()
  })
})

describe("document-registry – lookups", () => {
  it("returns document for IssueAssigneesLookup", () => {
    expect(getLookupDocument("IssueAssigneesLookup")).toContain("query IssueAssigneesLookup")
  })

  it("returns document for IssueAssigneesLookupByNumber", () => {
    expect(getLookupDocument("IssueAssigneesLookupByNumber")).toContain(
      "query IssueAssigneesLookupByNumber",
    )
  })

  it("returns document for IssueCreateRepositoryId", () => {
    expect(getLookupDocument("IssueCreateRepositoryId")).toContain("query IssueCreateRepositoryId")
  })

  it("returns document for IssueLabelsLookup", () => {
    expect(getLookupDocument("IssueLabelsLookup")).toContain("query IssueLabelsLookup")
  })

  it("returns document for IssueLabelsLookupByNumber", () => {
    expect(getLookupDocument("IssueLabelsLookupByNumber")).toContain(
      "query IssueLabelsLookupByNumber",
    )
  })

  it("returns document for IssueMilestoneLookup", () => {
    expect(getLookupDocument("IssueMilestoneLookup")).toContain("query IssueMilestoneLookup")
  })

  it("returns document for IssueNodeIdLookup", () => {
    expect(getLookupDocument("IssueNodeIdLookup")).toContain("query IssueNodeIdLookup")
  })

  it("returns document for IssueParentLookup", () => {
    expect(getLookupDocument("IssueParentLookup")).toContain("query IssueParentLookup")
  })

  it("returns document for PrNodeId", () => {
    expect(getLookupDocument("PrNodeId")).toContain("query PrNodeId")
  })

  it("returns document for UserNodeId", () => {
    expect(getLookupDocument("UserNodeId")).toContain("query UserNodeId")
  })

  it("throws on unknown lookup", () => {
    expect(() => getLookupDocument("NonExistentLookup")).toThrow()
  })
})
