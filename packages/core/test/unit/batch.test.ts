import { buildBatchMutation, buildBatchQuery, extractRootFieldName } from "@core/gql/batch.js"
import { describe, expect, it } from "vitest"

describe("extractRootFieldName", () => {
  it("returns the first field name from a standard query document", () => {
    const query = `query IssueLabelsLookupByNumber($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) { id }
  }
}`
    expect(extractRootFieldName(query)).toBe("repository")
  })

  it("handles leading whitespace before the root field", () => {
    const query = `query Foo {
    node(id: "x") { id }
}`
    expect(extractRootFieldName(query)).toBe("node")
  })

  it("returns null when the query has no opening brace", () => {
    expect(extractRootFieldName("not a valid query")).toBeNull()
  })
})

describe("buildBatchQuery", () => {
  it("wraps single query with alias", () => {
    const result = buildBatchQuery([
      {
        alias: "step0",
        query: `query IssueLabelsLookup($issueId: ID!) {
  node(id: $issueId) {
    ... on Issue { id }
  }
}`,
        variables: { issueId: "I_123" },
      },
    ])
    expect(result.document).toContain("query BatchChain")
    expect(result.document).toContain("step0:")
    expect(result.document).toContain("$step0_issueId: ID!")
    expect(result.variables).toEqual({ step0_issueId: "I_123" })
  })

  it("merges two queries", () => {
    const q = `query Foo($id: ID!) { node(id: $id) { id } }`
    const result = buildBatchQuery([
      { alias: "a", query: q, variables: { id: "1" } },
      { alias: "b", query: q, variables: { id: "2" } },
    ])
    expect(result.document).toContain("$a_id: ID!")
    expect(result.document).toContain("$b_id: ID!")
    expect(result.variables).toEqual({ a_id: "1", b_id: "2" })
  })

  it("throws on empty array", () => {
    expect(() => buildBatchQuery([])).toThrow()
  })
})

describe("buildBatchMutation", () => {
  it("wraps single mutation with alias", () => {
    const result = buildBatchMutation([
      {
        alias: "step0",
        mutation: `mutation CloseIssue($issueId: ID!) {
  closeIssue(input: {issueId: $issueId}) {
    issue { id }
  }
}`,
        variables: { issueId: "I_123" },
      },
    ])
    expect(result.document).toContain("mutation BatchComposite")
    expect(result.document).toContain("step0:")
    expect(result.variables).toEqual({ step0_issueId: "I_123" })
  })

  it("merges two mutations", () => {
    const m = `mutation UpdateIssue($issueId: ID!, $title: String!) { updateIssue(input: {id: $issueId, title: $title}) { issue { id } } }`
    const result = buildBatchMutation([
      { alias: "a", mutation: m, variables: { issueId: "I_1", title: "Title 1" } },
      { alias: "b", mutation: m, variables: { issueId: "I_2", title: "Title 2" } },
    ])
    expect(result.document).toContain("$a_issueId: ID!")
    expect(result.document).toContain("$b_title: String!")
    expect(result.variables).toEqual({
      a_issueId: "I_1",
      a_title: "Title 1",
      b_issueId: "I_2",
      b_title: "Title 2",
    })
  })

  it("preserves fragment definitions appended to mutation document", () => {
    const mutWithFragment = `mutation CreateIssue($repositoryId: ID!, $title: String!) {
  createIssue(input: {repositoryId: $repositoryId, title: $title}) {
    issue {
      ...IssueCoreFields
    }
  }
}
fragment IssueCoreFields on Issue {
  id
  number
  title
}`
    const result = buildBatchMutation([
      { alias: "step0", mutation: mutWithFragment, variables: { repositoryId: "R_1", title: "T" } },
    ])
    expect(result.document).toContain("...IssueCoreFields")
    expect(result.document).toContain("fragment IssueCoreFields on Issue")
  })

  it("deduplicates shared fragment definitions across operations", () => {
    const mutWithFragment = `mutation CreateIssue($repositoryId: ID!, $title: String!) {
  createIssue(input: {repositoryId: $repositoryId, title: $title}) {
    issue { ...IssueCoreFields }
  }
}
fragment IssueCoreFields on Issue {
  id
  number
}`
    const result = buildBatchMutation([
      { alias: "a", mutation: mutWithFragment, variables: { repositoryId: "R_1", title: "A" } },
      { alias: "b", mutation: mutWithFragment, variables: { repositoryId: "R_2", title: "B" } },
    ])
    const count = (result.document.match(/fragment IssueCoreFields/g) ?? []).length
    expect(count).toBe(1)
  })

  it("throws on empty array", () => {
    expect(() => buildBatchMutation([])).toThrow()
  })
})
