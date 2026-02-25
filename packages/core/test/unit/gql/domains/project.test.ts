import { describe, expect, it, vi } from "vitest"
import {
  runProjectV2FieldsList,
  runProjectV2ItemAdd,
  runProjectV2ItemsList,
  runProjectV2OrgView,
  runProjectV2UserView,
} from "../../../../src/gql/domains/project.js"
import type { GraphqlTransport } from "../../../../src/gql/transport.js"

const orgViewInput = {
  org: "acme-org",
  projectNumber: 1,
}

const userViewInput = {
  user: "alice",
  projectNumber: 2,
}

const fieldsListInput = {
  owner: "acme-org",
  projectNumber: 1,
  first: 10,
}

const itemsListInput = {
  owner: "acme-org",
  projectNumber: 1,
  first: 10,
}

function makeProjectData(overrides: Record<string, unknown> = {}) {
  return {
    id: "PVT_kwDOA_abc123",
    title: "My Project",
    shortDescription: "A test project",
    public: true,
    closed: false,
    url: "https://github.com/orgs/acme-org/projects/1",
    ...overrides,
  }
}

describe("runProjectV2OrgView", () => {
  it("throws when result.organization.projectV2 is null", async () => {
    const execute = vi.fn().mockResolvedValue({ organization: { projectV2: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2OrgView(transport, orgViewInput)).rejects.toThrow(
      "Project 1 not found for org acme-org",
    )
  })

  it("throws when result.organization is null", async () => {
    const execute = vi.fn().mockResolvedValue({ organization: null })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2OrgView(transport, orgViewInput)).rejects.toThrow(
      "Project 1 not found for org acme-org",
    )
  })

  it("returns mapped data when project exists", async () => {
    const project = makeProjectData()
    const execute = vi.fn().mockResolvedValue({ organization: { projectV2: project } })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2OrgView(transport, orgViewInput)

    expect(result.id).toBe("PVT_kwDOA_abc123")
    expect(result.title).toBe("My Project")
    expect(result.shortDescription).toBe("A test project")
    expect(result.public).toBe(true)
    expect(result.closed).toBe(false)
    expect(result.url).toBe("https://github.com/orgs/acme-org/projects/1")
  })

  it("maps shortDescription as null when absent", async () => {
    const project = makeProjectData({ shortDescription: null })
    const execute = vi.fn().mockResolvedValue({ organization: { projectV2: project } })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2OrgView(transport, orgViewInput)

    expect(result.shortDescription).toBeNull()
  })
})

describe("runProjectV2UserView", () => {
  it("throws when result.user.projectV2 is null", async () => {
    const execute = vi.fn().mockResolvedValue({ user: { projectV2: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2UserView(transport, userViewInput)).rejects.toThrow(
      "Project 2 not found for user alice",
    )
  })

  it("throws when result.user is null", async () => {
    const execute = vi.fn().mockResolvedValue({ user: null })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2UserView(transport, userViewInput)).rejects.toThrow(
      "Project 2 not found for user alice",
    )
  })

  it("returns mapped data when project exists", async () => {
    const project = makeProjectData({ url: "https://github.com/users/alice/projects/2" })
    const execute = vi.fn().mockResolvedValue({ user: { projectV2: project } })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2UserView(transport, userViewInput)

    expect(result.id).toBe("PVT_kwDOA_abc123")
    expect(result.title).toBe("My Project")
    expect(result.shortDescription).toBe("A test project")
    expect(result.public).toBe(true)
    expect(result.closed).toBe(false)
    expect(result.url).toBe("https://github.com/users/alice/projects/2")
  })

  it("maps shortDescription as null when absent", async () => {
    const project = makeProjectData({ shortDescription: null })
    const execute = vi.fn().mockResolvedValue({ user: { projectV2: project } })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2UserView(transport, userViewInput)

    expect(result.shortDescription).toBeNull()
  })
})

describe("runProjectV2FieldsList", () => {
  it("returns items and pageInfo from org branch", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: {
        projectV2: {
          fields: {
            nodes: [
              { id: "field-1", name: "Title", dataType: "TEXT" },
              { id: "field-2", name: "Status", dataType: "SINGLE_SELECT" },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2FieldsList(transport, fieldsListInput)

    expect(result.items).toHaveLength(2)
    expect(result.items[0]?.id).toBe("field-1")
    expect(result.items[0]?.name).toBe("Title")
    expect(result.items[0]?.dataType).toBe("TEXT")
    expect(result.items[1]?.id).toBe("field-2")
    expect(result.pageInfo.hasNextPage).toBe(false)
    expect(result.pageInfo.endCursor).toBeNull()
  })

  it("returns items and pageInfo from user branch when org is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: null,
      user: {
        projectV2: {
          fields: {
            nodes: [{ id: "field-u1", name: "Assignee", dataType: "ASSIGNEES" }],
            pageInfo: { hasNextPage: true, endCursor: "cursor-ghi" },
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2FieldsList(transport, fieldsListInput)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBe("field-u1")
    expect(result.items[0]?.name).toBe("Assignee")
    expect(result.items[0]?.dataType).toBe("ASSIGNEES")
    expect(result.pageInfo.hasNextPage).toBe(true)
    expect(result.pageInfo.endCursor).toBe("cursor-ghi")
  })

  it("filters null nodes from fields list", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: {
        projectV2: {
          fields: {
            nodes: [null, { id: "field-1", name: "Title", dataType: "TEXT" }, null],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2FieldsList(transport, fieldsListInput)

    expect(result.items).toHaveLength(3)
    expect(result.items[0]?.id).toBeNull()
    expect(result.items[1]?.id).toBe("field-1")
    expect(result.items[2]?.id).toBeNull()
  })

  it("returns empty items and default pageInfo when no connection found", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: null,
      user: null,
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2FieldsList(transport, fieldsListInput)

    expect(result.items).toHaveLength(0)
    expect(result.pageInfo.hasNextPage).toBe(false)
    expect(result.pageInfo.endCursor).toBeNull()
  })
})

describe("runProjectV2ItemsList", () => {
  it("returns items and pageInfo from org branch", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: {
        projectV2: {
          items: {
            nodes: [
              {
                id: "item-1",
                type: "ISSUE",
                content: { __typename: "Issue", number: 10, title: "Fix the bug" },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemsList(transport, itemsListInput)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBe("item-1")
    expect(result.items[0]?.contentType).toBe("ISSUE")
    expect(result.items[0]?.contentNumber).toBe(10)
    expect(result.items[0]?.contentTitle).toBe("Fix the bug")
    expect(result.pageInfo.hasNextPage).toBe(false)
    expect(result.pageInfo.endCursor).toBeNull()
  })

  it("returns items from user branch when org is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: null,
      user: {
        projectV2: {
          items: {
            nodes: [
              {
                id: "item-u1",
                type: "PULL_REQUEST",
                content: { __typename: "PullRequest", number: 5, title: "Add feature" },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemsList(transport, itemsListInput)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBe("item-u1")
    expect(result.items[0]?.contentType).toBe("PULL_REQUEST")
    expect(result.items[0]?.contentNumber).toBe(5)
    expect(result.items[0]?.contentTitle).toBe("Add feature")
  })

  it("sets contentNumber to null when content has no number field (DraftIssue)", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: {
        projectV2: {
          items: {
            nodes: [
              {
                id: "item-draft",
                type: "DRAFT_ISSUE",
                content: { __typename: "DraftIssue", title: "Draft item" },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemsList(transport, itemsListInput)

    expect(result.items[0]?.contentNumber).toBeNull()
    expect(result.items[0]?.contentTitle).toBe("Draft item")
  })

  it("sets contentNumber to null when content is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: {
        projectV2: {
          items: {
            nodes: [
              {
                id: "item-no-content",
                type: "ISSUE",
                content: null,
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemsList(transport, itemsListInput)

    expect(result.items[0]?.contentNumber).toBeNull()
    expect(result.items[0]?.contentTitle).toBeNull()
  })

  it("uses content.title for contentTitle", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: {
        projectV2: {
          items: {
            nodes: [
              {
                id: "item-pr",
                type: "PULL_REQUEST",
                content: { __typename: "PullRequest", number: 99, title: "My PR title" },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemsList(transport, itemsListInput)

    expect(result.items[0]?.contentTitle).toBe("My PR title")
  })

  it("returns empty items and default pageInfo when no connection found", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: null,
      user: null,
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemsList(transport, itemsListInput)

    expect(result.items).toHaveLength(0)
    expect(result.pageInfo.hasNextPage).toBe(false)
    expect(result.pageInfo.endCursor).toBeNull()
  })

  it("sets id and contentType to null when node is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: {
        projectV2: {
          items: {
            nodes: [null],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemsList(transport, itemsListInput)

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBeNull()
    expect(result.items[0]?.contentType).toBeNull()
    expect(result.items[0]?.contentNumber).toBeNull()
    expect(result.items[0]?.contentTitle).toBeNull()
  })
})

describe("runProjectV2OrgView — null field mapping", () => {
  it("maps id as null when project.id is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: {
        projectV2: {
          id: null,
          title: "T",
          shortDescription: null,
          public: true,
          closed: false,
          url: "u",
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2OrgView(transport, orgViewInput)

    expect(result.id).toBeNull()
  })

  it("maps title as null when project.title is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: {
        projectV2: {
          id: "p1",
          title: null,
          shortDescription: null,
          public: true,
          closed: false,
          url: "u",
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2OrgView(transport, orgViewInput)

    expect(result.title).toBeNull()
  })

  it("converts url via String() when url is not a string", async () => {
    const execute = vi.fn().mockResolvedValue({
      organization: {
        projectV2: {
          id: "p1",
          title: "T",
          shortDescription: null,
          public: true,
          closed: false,
          url: { href: "https://example.com" },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2OrgView(transport, orgViewInput)

    expect(typeof result.url).toBe("string")
  })
})

describe("runProjectV2UserView — null field mapping", () => {
  it("maps id as null when project.id is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      user: {
        projectV2: {
          id: null,
          title: "T",
          shortDescription: null,
          public: true,
          closed: false,
          url: "u",
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2UserView(transport, userViewInput)

    expect(result.id).toBeNull()
  })
})

describe("resolveIssueNodeId via runProjectV2ItemAdd", () => {
  const addInput = {
    owner: "acme",
    projectNumber: 1,
    issueUrl: "https://github.com/acme/repo/issues/99",
  }

  it("throws when resource __typename is not Issue", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ organization: { projectV2: { id: "PVT_proj1" } } })
      .mockResolvedValueOnce({ resource: { __typename: "PullRequest", id: "PR_abc" } })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemAdd(transport, addInput)).rejects.toThrow(
      `Issue not found at URL "${addInput.issueUrl}"`,
    )
  })

  it("throws when resource has no id field", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ organization: { projectV2: { id: "PVT_proj1" } } })
      .mockResolvedValueOnce({ resource: { __typename: "Issue" } })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemAdd(transport, addInput)).rejects.toThrow(
      `Issue not found at URL "${addInput.issueUrl}"`,
    )
  })
})
