import { getLookupDocument, getMutationDocument } from "@core/gql/document-registry.js"
import { describe, expect, it } from "vitest"

describe("document-registry", () => {
  it("getLookupDocument returns document for IssueLabelsLookup", () => {
    const doc = getLookupDocument("IssueLabelsLookup")
    expect(doc).toContain("query IssueLabelsLookup")
  })

  it("getLookupDocument returns document for IssueMilestoneLookup", () => {
    const doc = getLookupDocument("IssueMilestoneLookup")
    expect(doc).toContain("milestoneNumber")
  })

  it("getMutationDocument returns document for IssueLabelsUpdate", () => {
    const doc = getMutationDocument("IssueLabelsUpdate")
    expect(doc).toContain("mutation IssueLabelsUpdate")
  })

  it("getLookupDocument throws on unknown operation", () => {
    expect(() => getLookupDocument("UnknownOp")).toThrow()
  })

  it("getMutationDocument throws on unknown operation", () => {
    expect(() => getMutationDocument("UnknownOp")).toThrow()
  })
})
