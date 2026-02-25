import { describe, expect, it, vi } from "vitest"
import { runReleaseList, runReleaseView } from "../../../../src/gql/domains/release.js"
import type { GraphqlTransport } from "../../../../src/gql/transport.js"

const baseViewInput = {
  owner: "acme",
  name: "repo",
  tagName: "v1.0.0",
}

const baseListInput = {
  owner: "acme",
  name: "repo",
  first: 10,
}

function makeReleaseNode(overrides: Record<string, unknown> = {}) {
  return {
    databaseId: 42,
    tagName: "v1.0.0",
    name: "Release 1.0.0",
    isDraft: false,
    isPrerelease: false,
    url: "https://github.com/acme/repo/releases/tag/v1.0.0",
    createdAt: "2025-01-01T00:00:00Z",
    publishedAt: "2025-01-01T12:00:00Z",
    tagCommit: { oid: "abc123def456" },
    ...overrides,
  }
}

describe("runReleaseView", () => {
  it("throws when result.repository is null", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: null })
    const transport: GraphqlTransport = { execute }

    await expect(runReleaseView(transport, baseViewInput)).rejects.toThrow("Release not found")
  })

  it("throws when result.repository.release is null", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: { release: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runReleaseView(transport, baseViewInput)).rejects.toThrow("Release not found")
  })

  it("returns mapped data when repository and release exist", async () => {
    const node = makeReleaseNode()
    const execute = vi.fn().mockResolvedValue({ repository: { release: node } })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseView(transport, baseViewInput)

    expect(result.id).toBe(42)
    expect(result.tagName).toBe("v1.0.0")
    expect(result.name).toBe("Release 1.0.0")
    expect(result.isDraft).toBe(false)
    expect(result.isPrerelease).toBe(false)
    expect(result.url).toBe("https://github.com/acme/repo/releases/tag/v1.0.0")
    expect(result.createdAt).toBe("2025-01-01T00:00:00Z")
    expect(result.publishedAt).toBe("2025-01-01T12:00:00Z")
    expect(result.targetCommitish).toBe("abc123def456")
  })

  it("maps id as null when databaseId is null", async () => {
    const node = makeReleaseNode({ databaseId: null })
    const execute = vi.fn().mockResolvedValue({ repository: { release: node } })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseView(transport, baseViewInput)

    expect(result.id).toBeNull()
  })

  it("maps name as null when name is null", async () => {
    const node = makeReleaseNode({ name: null })
    const execute = vi.fn().mockResolvedValue({ repository: { release: node } })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseView(transport, baseViewInput)

    expect(result.name).toBeNull()
  })

  it("maps targetCommitish as null when tagCommit is null", async () => {
    const node = makeReleaseNode({ tagCommit: null })
    const execute = vi.fn().mockResolvedValue({ repository: { release: node } })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseView(transport, baseViewInput)

    expect(result.targetCommitish).toBeNull()
  })

  it("maps publishedAt as null when publishedAt is null", async () => {
    const node = makeReleaseNode({ publishedAt: null })
    const execute = vi.fn().mockResolvedValue({ repository: { release: node } })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseView(transport, baseViewInput)

    expect(result.publishedAt).toBeNull()
  })
})

describe("runReleaseList", () => {
  it("throws when result.repository is null", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: null })
    const transport: GraphqlTransport = { execute }

    await expect(runReleaseList(transport, baseListInput)).rejects.toThrow(
      "Repository acme/repo not found",
    )
  })

  it("returns mapped items and pageInfo when repository exists", async () => {
    const node = makeReleaseNode()
    const execute = vi.fn().mockResolvedValue({
      repository: {
        releases: {
          nodes: [node],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseList(transport, baseListInput)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.tagName).toBe("v1.0.0")
    expect(result.items[0]?.id).toBe(42)
    expect(result.pageInfo.hasNextPage).toBe(false)
    expect(result.pageInfo.endCursor).toBeNull()
  })

  it("returns pageInfo with cursor when more pages exist", async () => {
    const node = makeReleaseNode()
    const execute = vi.fn().mockResolvedValue({
      repository: {
        releases: {
          nodes: [node],
          pageInfo: { hasNextPage: true, endCursor: "cursor-xyz" },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseList(transport, baseListInput)

    expect(result.pageInfo.hasNextPage).toBe(true)
    expect(result.pageInfo.endCursor).toBe("cursor-xyz")
  })

  it("filters out null nodes via flatMap", async () => {
    const node = makeReleaseNode()
    const execute = vi.fn().mockResolvedValue({
      repository: {
        releases: {
          nodes: [null, node, null],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseList(transport, baseListInput)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.tagName).toBe("v1.0.0")
  })

  it("returns empty items when nodes is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        releases: {
          nodes: null,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseList(transport, baseListInput)

    expect(result.items).toHaveLength(0)
  })

  it("returns empty items and default pageInfo when releases connection is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        releases: null,
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseList(transport, baseListInput)

    expect(result.items).toHaveLength(0)
    expect(result.pageInfo.hasNextPage).toBe(false)
    expect(result.pageInfo.endCursor).toBeNull()
  })

  it("maps all release fields correctly across multiple nodes", async () => {
    const node1 = makeReleaseNode({ tagName: "v2.0.0", databaseId: 100 })
    const node2 = makeReleaseNode({ tagName: "v1.0.0", databaseId: null })
    const execute = vi.fn().mockResolvedValue({
      repository: {
        releases: {
          nodes: [node1, node2],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseList(transport, baseListInput)

    expect(result.items).toHaveLength(2)
    expect(result.items[0]?.tagName).toBe("v2.0.0")
    expect(result.items[0]?.id).toBe(100)
    expect(result.items[1]?.tagName).toBe("v1.0.0")
    expect(result.items[1]?.id).toBeNull()
  })
})

describe("mapReleaseNode String() conversion branches", () => {
  it("converts non-string url via String()", async () => {
    const node = {
      databaseId: 1,
      tagName: "v1.0.0",
      name: "Release",
      isDraft: false,
      isPrerelease: false,
      url: { toString: () => "https://example.com/releases/v1.0.0" },
      createdAt: "2025-01-01T00:00:00Z",
      publishedAt: null,
      tagCommit: null,
    }
    const execute = vi.fn().mockResolvedValue({ repository: { release: node } })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseView(transport, baseViewInput)

    expect(typeof result.url).toBe("string")
  })

  it("converts non-string tagCommit.oid via String()", async () => {
    const node = makeReleaseNode({ tagCommit: { oid: 12345 } })
    const execute = vi.fn().mockResolvedValue({ repository: { release: node } })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseView(transport, baseViewInput)

    expect(result.targetCommitish).toBe("12345")
  })

  it("converts non-string createdAt via String()", async () => {
    const node = makeReleaseNode({ createdAt: 1735689600000 })
    const execute = vi.fn().mockResolvedValue({ repository: { release: node } })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseView(transport, baseViewInput)

    expect(typeof result.createdAt).toBe("string")
    expect(result.createdAt).toBe("1735689600000")
  })

  it("converts non-string publishedAt via String()", async () => {
    const node = makeReleaseNode({ publishedAt: 1735689600000 })
    const execute = vi.fn().mockResolvedValue({ repository: { release: node } })
    const transport: GraphqlTransport = { execute }

    const result = await runReleaseView(transport, baseViewInput)

    expect(result.publishedAt).toBe("1735689600000")
  })
})
