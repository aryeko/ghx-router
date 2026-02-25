import { createGithubClientFromToken } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("createGithubClientFromToken", () => {
  it("throws when token is empty", () => {
    expect(() => createGithubClientFromToken("")).toThrow("GitHub token is required")
  })

  it("throws when token is whitespace only", () => {
    expect(() => createGithubClientFromToken("   ")).toThrow("GitHub token is required")
  })

  it("throws when options token is empty", () => {
    expect(() => createGithubClientFromToken({ token: "" })).toThrow("GitHub token is required")
  })

  it("throws when options token is whitespace only", () => {
    expect(() => createGithubClientFromToken({ token: "  " })).toThrow("GitHub token is required")
  })

  it("returns a client for a valid string token", () => {
    const client = createGithubClientFromToken("ghp_test123")
    expect(client).toBeDefined()
    expect(typeof client.fetchRepoView).toBe("function")
    expect(typeof client.fetchIssueView).toBe("function")
    expect(typeof client.fetchPrView).toBe("function")
    expect(typeof client.query).toBe("function")
  })

  it("returns a client when using options object", () => {
    const client = createGithubClientFromToken({
      token: "ghp_test123",
      graphqlUrl: "https://custom.github.com/graphql",
    })
    expect(client).toBeDefined()
    expect(typeof client.query).toBe("function")
  })

  it("returns a client with mutation methods", () => {
    const client = createGithubClientFromToken("ghp_test123")
    expect(typeof client.replyToReviewThread).toBe("function")
    expect(typeof client.resolveReviewThread).toBe("function")
    expect(typeof client.unresolveReviewThread).toBe("function")
  })
})
