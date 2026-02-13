import { describe, expect, it } from "vitest"

import { createGithubClient } from "../../src/gql/client.js"

describe("createGithubClient", () => {
  it("exposes typed repo.view helper", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            id: "repo-id",
            name: "modkit",
            nameWithOwner: "go-modkit/modkit",
            isPrivate: false,
            stargazerCount: 10,
            forkCount: 2,
            url: "https://github.com/go-modkit/modkit",
            defaultBranchRef: { name: "main" }
          }
        } as TData
      }
    })

    const result = await client.fetchRepoView({ owner: "go-modkit", name: "modkit" })

    expect(result.nameWithOwner).toBe("go-modkit/modkit")
    expect(result.defaultBranch).toBe("main")
  })

  it("exposes typed issue.view helper", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            issue: {
              id: "issue-id",
              number: 210,
              title: "Fix parser edge case",
              state: "OPEN",
              url: "https://github.com/go-modkit/modkit/issues/210"
            }
          }
        } as TData
      }
    })

    const issue = await client.fetchIssueView({ owner: "go-modkit", name: "modkit", issueNumber: 210 })

    expect(issue.number).toBe(210)
    expect(issue.title).toContain("parser")
  })

  it("exposes typed pr.view helper", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              id: "pr-id",
              number: 232,
              title: "Add benchmark improvements",
              state: "OPEN",
              url: "https://github.com/go-modkit/modkit/pull/232"
            }
          }
        } as TData
      }
    })

    const pr = await client.fetchPrView({ owner: "go-modkit", name: "modkit", prNumber: 232 })

    expect(pr.number).toBe(232)
    expect(pr.title).toContain("benchmark")
  })
})
