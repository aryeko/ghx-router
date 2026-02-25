import { describe, expect, it, vi } from "vitest"
import { runRepoIssueTypesList, runRepoLabelsList } from "../../../../src/gql/domains/repo.js"
import type { GraphqlTransport } from "../../../../src/gql/transport.js"

const baseInput = {
  owner: "acme",
  name: "repo",
  first: 10,
}

describe("runRepoLabelsList", () => {
  it("throws with descriptive message when result.repository is null", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: null })
    const transport: GraphqlTransport = { execute }

    await expect(runRepoLabelsList(transport, baseInput)).rejects.toThrow(
      "Repository acme/repo not found",
    )
  })

  it("returns items and pageInfo when repository has labels", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        labels: {
          nodes: [
            {
              id: "label-1",
              name: "bug",
              description: "Something is not working",
              color: "d73a4a",
              isDefault: true,
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runRepoLabelsList(transport, baseInput)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBe("label-1")
    expect(result.items[0]?.name).toBe("bug")
    expect(result.items[0]?.description).toBe("Something is not working")
    expect(result.items[0]?.color).toBe("d73a4a")
    expect(result.items[0]?.isDefault).toBe(true)
    expect(result.pageInfo.hasNextPage).toBe(false)
    expect(result.pageInfo.endCursor).toBeNull()
  })

  it("returns pageInfo with cursor when more pages exist", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        labels: {
          nodes: [],
          pageInfo: { hasNextPage: true, endCursor: "cursor-abc" },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runRepoLabelsList(transport, baseInput)

    expect(result.pageInfo.hasNextPage).toBe(true)
    expect(result.pageInfo.endCursor).toBe("cursor-abc")
  })

  it("returns empty items when nodes is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        labels: {
          nodes: null,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runRepoLabelsList(transport, baseInput)

    expect(result.items).toHaveLength(0)
  })

  it("maps null node fields to null", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        labels: {
          nodes: [null],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runRepoLabelsList(transport, baseInput)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBeNull()
    expect(result.items[0]?.name).toBeNull()
    expect(result.items[0]?.description).toBeNull()
    expect(result.items[0]?.color).toBeNull()
    expect(result.items[0]?.isDefault).toBeNull()
  })

  it("returns empty items and default pageInfo when labels connection is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: { labels: null },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runRepoLabelsList(transport, baseInput)

    expect(result.items).toHaveLength(0)
    expect(result.pageInfo.hasNextPage).toBe(false)
    expect(result.pageInfo.endCursor).toBeNull()
  })
})

describe("runRepoIssueTypesList", () => {
  it("throws with descriptive message when result.repository is null", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: null })
    const transport: GraphqlTransport = { execute }

    await expect(runRepoIssueTypesList(transport, baseInput)).rejects.toThrow(
      "Repository acme/repo not found",
    )
  })

  it("returns items and pageInfo when repository has issue types", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        issueTypes: {
          nodes: [
            {
              id: "issuetype-1",
              name: "Bug",
              color: "RED",
              isEnabled: true,
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runRepoIssueTypesList(transport, baseInput)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBe("issuetype-1")
    expect(result.items[0]?.name).toBe("Bug")
    expect(result.items[0]?.color).toBe("RED")
    expect(result.items[0]?.isEnabled).toBe(true)
    expect(result.pageInfo.hasNextPage).toBe(false)
    expect(result.pageInfo.endCursor).toBeNull()
  })

  it("keeps color as null when issue type color is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        issueTypes: {
          nodes: [
            {
              id: "issuetype-2",
              name: "Task",
              color: null,
              isEnabled: true,
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runRepoIssueTypesList(transport, baseInput)
    expect(result.items[0]?.color).toBeNull()
  })

  it("returns pageInfo with cursor when more pages exist", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        issueTypes: {
          nodes: [],
          pageInfo: { hasNextPage: true, endCursor: "cursor-def" },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runRepoIssueTypesList(transport, baseInput)

    expect(result.pageInfo.hasNextPage).toBe(true)
    expect(result.pageInfo.endCursor).toBe("cursor-def")
  })

  it("returns empty items when nodes is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        issueTypes: {
          nodes: null,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runRepoIssueTypesList(transport, baseInput)

    expect(result.items).toHaveLength(0)
  })

  it("maps null node fields to null", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        issueTypes: {
          nodes: [null],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runRepoIssueTypesList(transport, baseInput)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBeNull()
    expect(result.items[0]?.name).toBeNull()
    expect(result.items[0]?.color).toBeNull()
    expect(result.items[0]?.isEnabled).toBeNull()
  })

  it("returns empty items and default pageInfo when issueTypes connection is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: { issueTypes: null },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runRepoIssueTypesList(transport, baseInput)

    expect(result.items).toHaveLength(0)
    expect(result.pageInfo.hasNextPage).toBe(false)
    expect(result.pageInfo.endCursor).toBeNull()
  })
})
