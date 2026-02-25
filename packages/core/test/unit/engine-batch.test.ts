import type { OperationCard } from "@core/core/registry/types.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { baseCard, createGithubClient } from "../helpers/engine-fixtures.js"

// These mocks are re-registered after each vi.resetModules() via beforeEach
const executeMock = vi.fn()
const getOperationCardMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  executeMock.mockReset()
  getOperationCardMock.mockReset()
  vi.doMock("@core/core/execute/execute.js", () => ({
    execute: (...args: unknown[]) => executeMock(...args),
  }))
  vi.doMock("@core/core/registry/index.js", () => ({
    getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
  }))
})

// ---------------------------------------------------------------------------
// Helper: sets up mocks for a mixed CLI+GQL chain.
// Pre-flight: step 0 → cliCard, step 1 → gqlCard; executeTask re-loads card
// for CLI step → cliCard again.
// ---------------------------------------------------------------------------
function setupMixedChainMocks(cliCard: unknown, gqlCard: unknown): void {
  getOperationCardMock
    .mockReturnValueOnce(cliCard as OperationCard)
    .mockReturnValueOnce(gqlCard as OperationCard)
    .mockReturnValue(cliCard as OperationCard)
}

// ===========================================================================
// Pure batch mutation chain
// ===========================================================================

describe("executeTasks chaining — batch mutations", () => {
  it("2-item pure-mutation chain returns success after batch mutation", async () => {
    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    const getMutationDocumentMock = vi
      .fn()
      .mockReturnValue(
        `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
      )
    const buildBatchMutationMock = vi.fn().mockReturnValue({
      document: `mutation BatchComposite { step0: createIssue { issue { id } } step1: createIssue { issue { id } } }`,
      variables: {
        step0_repositoryId: "R1",
        step0_title: "Issue 1",
        step1_repositoryId: "R2",
        step1_title: "Issue 2",
      },
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: getMutationDocumentMock,
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: buildBatchMutationMock,
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        {
          task: "issue.create",
          input: { repositoryId: "R1", title: "Issue 1" },
        },
        {
          task: "issue.create",
          input: { repositoryId: "R2", title: "Issue 2" },
        },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {
              step0: { issue: { id: "I1" } },
              step1: { issue: { id: "I2" } },
            },
            errors: undefined,
          }),
        }),
      },
    )

    expect(getMutationDocumentMock).toHaveBeenCalledWith("IssueCreate")
    expect(buildBatchMutationMock).toHaveBeenCalled()
    expect(result.status).toBe("success")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({ task: "issue.create", ok: true })
    expect(result.results[1]).toMatchObject({ task: "issue.create", ok: true })
  })

  it("status is failed when batch mutation query rejects", async () => {
    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation BatchComposite { step0: createIssue { issue { id } } }`,
        variables: { step0_repositoryId: "R1", step0_title: "Issue 1" },
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        {
          task: "issue.create",
          input: { repositoryId: "R1", title: "Issue 1" },
        },
        {
          task: "issue.create",
          input: { repositoryId: "R2", title: "Issue 2" },
        },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockRejectedValue(new Error("network error")),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[1]?.ok).toBe(false)
  })
})

// ===========================================================================
// Mixed resolution chain (Phase 1 lookup + Phase 2 mutation)
// ===========================================================================

describe("executeTasks — mixed resolution chain", () => {
  it("handles chain where step 0 has no resolution and step 1 requires Phase 1 lookup", async () => {
    const cardNoResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "src/gql/operations/issue-labels-set.graphql",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "src/gql/operations/issue-labels-lookup.graphql",
            vars: { owner: "owner", name: "name" },
          },
          inject: [
            {
              target: "labelIds",
              source: "map_array" as const,
              from_input: "labels",
              nodes_path: "repository.labels.nodes",
              match_field: "name",
              extract_field: "id",
            },
          ],
        },
      },
    }

    getOperationCardMock
      .mockReturnValueOnce(cardNoResolution)
      .mockReturnValueOnce(cardWithResolution)

    const buildBatchQueryMock = vi.fn().mockReturnValue({
      document: `query BatchQuery { step1: repository { labels { nodes { id name } } } }`,
      variables: { step1_owner: "acme", step1_name: "repo" },
    })
    const buildBatchMutationMock = vi.fn().mockReturnValue({
      document: `mutation BatchMut { step0: closeIssue { issue { id } } step1: updateIssue { issue { id } } }`,
      variables: {},
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi
        .fn()
        .mockReturnValue(
          `query IssueLabelsLookup($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { labels(first: 100) { nodes { id name } } } }`,
        ),
      getMutationDocument: vi
        .fn()
        .mockImplementation((op: string) =>
          op === "IssueClose"
            ? `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`
            : `mutation IssueLabelsSet($issueId: ID!, $labelIds: [ID!]!) { updateIssue(input: {id: $issueId, labelIds: $labelIds}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: buildBatchQueryMock,
      buildBatchMutation: buildBatchMutationMock,
      // Real GitHub returns the root field value directly under the alias key.
      // extractRootFieldName returns "repository" so engine re-wraps it correctly.
      extractRootFieldName: vi.fn().mockReturnValue("repository"),
    }))
    vi.doMock("@core/gql/resolve.js", () => ({
      applyInject: vi.fn().mockReturnValue({ labelIds: ["L1"] }),
      buildMutationVars: vi
        .fn()
        .mockImplementation(
          (_doc: string, input: Record<string, unknown>, resolved: Record<string, unknown>) => ({
            ...input,
            ...resolved,
          }),
        ),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    // Phase 1 uses query (lookup), Phase 2 uses queryRaw (mutation).
    const queryMock = vi.fn().mockResolvedValueOnce({
      step1: { labels: { nodes: [{ id: "L1", name: "bug" }] } },
    })
    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: { closeIssue: { issue: { id: "I1" } } },
        step1: { updateIssue: { issue: { id: "I2" } } },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        {
          task: "issue.labels.set",
          input: {
            issueId: "I2",
            owner: "acme",
            name: "repo",
            labels: ["bug"],
          },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: queryRawMock,
        }),
      },
    )

    expect(buildBatchQueryMock).toHaveBeenCalled()
    expect(buildBatchMutationMock).toHaveBeenCalled()
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("success")
    expect(result.results[0]).toMatchObject({ task: "issue.close", ok: true })
    expect(result.results[1]).toMatchObject({
      task: "issue.labels.set",
      ok: true,
    })
  })
})

// ===========================================================================
// Resolution cache
// ===========================================================================

describe("executeTasks — resolution cache", () => {
  it("skips Phase 1 network call when all lookups are cached", async () => {
    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "src/gql/operations/issue-labels-set.graphql",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "src/gql/operations/issue-labels-lookup.graphql",
            vars: { issueId: "issueId" },
          },
          inject: [
            {
              target: "labelIds",
              source: "map_array" as const,
              from_input: "labels",
              nodes_path: "repository.labels.nodes",
              match_field: "name",
              extract_field: "id",
            },
          ],
        },
      },
    }
    getOperationCardMock.mockReturnValue(cardWithResolution)

    const buildBatchQueryMock = vi.fn()
    const buildBatchMutationMock = vi.fn().mockReturnValue({
      document: `mutation Batch { step0: updateIssue { issue { id } } step1: updateIssue { issue { id } } }`,
      variables: {},
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi
        .fn()
        .mockReturnValue(
          `query IssueLabelsLookup($issueId: ID!) { node(id: $issueId) { ... on Issue { repository { labels(first: 100) { nodes { id name } } } } } }`,
        ),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueLabelsSet($issueId: ID!, $labelIds: [ID!]!) { updateIssue(input: {id: $issueId, labelIds: $labelIds}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: buildBatchQueryMock,
      buildBatchMutation: buildBatchMutationMock,
    }))
    vi.doMock("@core/gql/resolve.js", () => ({
      applyInject: vi.fn().mockReturnValue({ labelIds: ["L1"] }),
      buildMutationVars: vi
        .fn()
        .mockImplementation(
          (_doc: string, input: Record<string, unknown>, resolved: Record<string, unknown>) => ({
            ...input,
            ...resolved,
          }),
        ),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")
    const { buildCacheKey, createResolutionCache } = await import(
      "@core/core/routing/resolution-cache.js"
    )

    // Pre-populate cache for both lookups
    const cache = createResolutionCache()
    const cachedData = {
      repository: { labels: { nodes: [{ id: "L1", name: "bug" }] } },
    }
    cache.set(buildCacheKey("IssueLabelsLookup", { issueId: "I1" }), cachedData)
    cache.set(buildCacheKey("IssueLabelsLookup", { issueId: "I2" }), cachedData)

    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: { updateIssue: { issue: { id: "I1" } } },
        step1: { updateIssue: { issue: { id: "I2" } } },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        { task: "issue.labels.set", input: { issueId: "I1", labels: ["bug"] } },
        { task: "issue.labels.set", input: { issueId: "I2", labels: ["bug"] } },
      ],
      {
        githubClient: createGithubClient({ queryRaw: queryRawMock }),
        resolutionCache: cache,
      },
    )

    // Phase 1 batch query should NOT have been called
    expect(buildBatchQueryMock).not.toHaveBeenCalled()
    // Only Phase 2 mutation query (via queryRaw)
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("success")
  })
})

// ===========================================================================
// Partial error handling
// ===========================================================================

describe("executeTasks — partial error handling", () => {
  it("Phase 2 partial failure: one step errors, other succeeds → status partial", async () => {
    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation Batch { step0: createIssue { issue { id } } step1: createIssue { issue { id } } }`,
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        {
          task: "issue.create",
          input: { repositoryId: "R1", title: "Issue 1" },
        },
        {
          task: "issue.create",
          input: { repositoryId: "R2", title: "Issue 2" },
        },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {
              step0: { createIssue: { issue: { id: "I1" } } },
              step1: null,
            },
            errors: [
              {
                message: "Could not resolve repository",
                path: ["step1", "createIssue"],
              },
            ],
          }),
        }),
      },
    )

    expect(result.status).toBe("partial")
    expect(result.results[0]?.ok).toBe(true)
    expect(result.results[0]?.data).toEqual({
      createIssue: { issue: { id: "I1" } },
    })
    expect(result.results[1]?.ok).toBe(false)
    expect(result.results[1]?.error?.message).toContain("Could not resolve repository")
  })

  it("Phase 2 unattributed error: errors without path → all steps failed", async () => {
    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation Batch { step0: createIssue { issue { id } } step1: createIssue { issue { id } } }`,
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        {
          task: "issue.create",
          input: { repositoryId: "R1", title: "Issue 1" },
        },
        {
          task: "issue.create",
          input: { repositoryId: "R2", title: "Issue 2" },
        },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {},
            errors: [{ message: "Internal server error" }],
          }),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toBe("Internal server error")
    expect(result.results[1]?.ok).toBe(false)
    expect(result.results[1]?.error?.message).toBe("Internal server error")
  })

  it("Phase 2 numeric path[0]: non-string path element → all steps failed", async () => {
    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation Batch { step0: createIssue { issue { id } } step1: createIssue { issue { id } } }`,
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        {
          task: "issue.create",
          input: { repositoryId: "R1", title: "Issue 1" },
        },
        {
          task: "issue.create",
          input: { repositoryId: "R2", title: "Issue 2" },
        },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {},
            errors: [{ message: "Some error", path: [0, "createIssue"] }],
          }),
        }),
      },
    )

    // path[0] is a number, not a string alias, so attribution fails → all steps failed
    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toBe("Some error")
    expect(result.results[1]?.ok).toBe(false)
    expect(result.results[1]?.error?.message).toBe("Some error")
  })

  it("Phase 2 missing alias: step result absent from response → error for that step", async () => {
    const card = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(card)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi.fn().mockReturnValue("mutation IssueClose { closeIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation { step0: closeIssue { id } step1: closeIssue { id } }",
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: { step0: { closeIssue: { id: "I1" } } },
            errors: undefined,
          }),
        }),
      },
    )

    // step0 succeeded, step1 has missing alias
    const r0 = result.results[0]
    const r1 = result.results[1]
    expect(r0?.ok).toBe(true)
    expect(r1?.ok).toBe(false)
    expect((r1 as { ok: false; error: { message: string } }).error.message).toContain(
      "missing mutation result",
    )
  })

  it("Phase 2 transport failure: queryRaw throws → all steps failed with retryable code", async () => {
    const card = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(card)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi.fn().mockReturnValue("mutation IssueClose { closeIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation { step0: closeIssue { id } step1: closeIssue { id } }",
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1")),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results).toHaveLength(2)
    const s0 = result.results[0]
    const s1 = result.results[1]
    expect(s0?.ok).toBe(false)
    expect(s1?.ok).toBe(false)
    const err = (s0 as { ok: false; error: { message: string; retryable: boolean } }).error
    expect(err.message).toBe("connect ECONNREFUSED 127.0.0.1")
    expect(err.retryable).toBe(true)
  })

  it("Phase 2 clean response: no errors → status success", async () => {
    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation Batch { step0: closeIssue { issue { id } } step1: closeIssue { issue { id } } }`,
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {
              step0: { closeIssue: { issue: { id: "I1" } } },
              step1: { closeIssue: { issue: { id: "I2" } } },
            },
            errors: undefined,
          }),
        }),
      },
    )

    expect(result.status).toBe("success")
    expect(result.results[0]?.ok).toBe(true)
    expect(result.results[1]?.ok).toBe(true)
  })
})

// ===========================================================================
// Phase 1 alias un-wrap regression
// ===========================================================================

describe("executeTasks — Phase 1 alias un-wrap regression", () => {
  it("re-wraps de-aliased lookup result so applyInject scalar path traversal succeeds", async () => {
    const cardNoResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    const cardWithScalarResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelAdd",
        documentPath: "src/gql/operations/issue-label-add.graphql",
        resolution: {
          lookup: {
            operationName: "IssueLookup",
            documentPath: "src/gql/operations/issue-lookup.graphql",
            vars: { issueNumber: "issueNumber", owner: "owner", name: "name" },
          },
          inject: [
            {
              target: "labelableId",
              source: "scalar" as const,
              path: "repository.issue.id",
            },
          ],
        },
      },
    }

    getOperationCardMock
      .mockReturnValueOnce(cardNoResolution)
      .mockReturnValueOnce(cardWithScalarResolution)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi
        .fn()
        .mockReturnValue(
          `query IssueLookup($issueNumber: Int!, $owner: String!, $name: String!) { repository(owner: $owner, name: $name) { issue(number: $issueNumber) { id } } }`,
        ),
      getMutationDocument: vi
        .fn()
        .mockImplementation((op: string) =>
          op === "IssueClose"
            ? `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`
            : `mutation IssueLabelAdd($labelableId: ID!) { addLabelsToLabelable(input: {labelableId: $labelableId}) { labelable { id } } }`,
        ),
    }))

    // Restore real batch and resolve implementations
    vi.doMock("@core/gql/batch.js", async () => {
      return await vi.importActual("@core/gql/batch.js")
    })
    vi.doMock("@core/gql/resolve.js", async () => {
      return await vi.importActual("@core/gql/resolve.js")
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    // Real GitHub response: root field value is returned directly under the alias key.
    // Engine must re-wrap it before applyInject runs.
    const queryMock = vi.fn().mockResolvedValueOnce({
      step1: { issue: { id: "I_XYZ" } },
    })
    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: { closeIssue: { issue: { id: "I_1" } } },
        step1: { addLabelsToLabelable: { labelable: { id: "I_XYZ" } } },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I_1" } },
        {
          task: "issue.labels.set",
          input: {
            issueNumber: 42,
            owner: "acme",
            name: "repo",
            labelableId: "placeholder",
          },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: queryRawMock,
        }),
      },
    )

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("success")
    expect(result.results[0]).toMatchObject({ task: "issue.close", ok: true })
    expect(result.results[1]).toMatchObject({
      task: "issue.labels.set",
      ok: true,
    })
  })
})

// ===========================================================================
// CLI chain support
// ===========================================================================

describe("executeTasks — CLI chain support", () => {
  it("executes all steps via executeTask when all cards are CLI-only", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    getOperationCardMock.mockReturnValue(cliCard)
    executeMock.mockResolvedValue({ ok: true, data: { id: "cli-result" } })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("success")
    expect(result.meta.route_used).toBe("cli")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({ ok: true, data: { id: "cli-result" } })
    expect(result.results[1]).toMatchObject({ ok: true, data: { id: "cli-result" } })
  })

  it("propagates CLI step failure into step result", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    getOperationCardMock.mockReturnValue(cliCard)
    executeMock.mockResolvedValue({
      ok: false,
      error: { code: "UNKNOWN", message: "cli failed", retryable: false },
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]).toMatchObject({ ok: false })
    expect(result.results[0]?.error?.message).toBe("cli failed")
    expect(result.results[1]).toMatchObject({ ok: false })
  })

  it("mixes CLI and GQL steps in the same chain with route_used: graphql", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    const gqlCard = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    setupMixedChainMocks(cliCard, gqlCard)

    executeMock.mockResolvedValue({ ok: true, data: { id: "cli-result" } })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation Batch { step1: closeIssue { issue { id } } }`,
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.close", input: { issueId: "I1" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {
              step1: { closeIssue: { issue: { id: "I1" } } },
            },
            errors: undefined,
          }),
        }),
      },
    )

    expect(result.status).toBe("success")
    expect(result.meta.route_used).toBe("graphql")
    expect(result.results[0]).toMatchObject({ ok: true, data: { id: "cli-result" } })
    expect(result.results[1]).toMatchObject({ ok: true })
  })

  it("reports partial status when CLI step fails and GQL step succeeds", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    const gqlCard = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    setupMixedChainMocks(cliCard, gqlCard)

    // CLI step fails
    executeMock.mockResolvedValue({
      ok: false,
      error: { code: "UNKNOWN", message: "cli failed", retryable: false },
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation Batch { step1: closeIssue { issue { id } } }`,
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.close", input: { issueId: "I1" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {
              step1: { closeIssue: { issue: { id: "I1" } } },
            },
            errors: undefined,
          }),
        }),
      },
    )

    expect(result.status).toBe("partial")
    expect(result.meta.route_used).toBe("graphql")
    expect(result.results[0]).toMatchObject({ ok: false, error: { message: "cli failed" } })
    expect(result.results[1]).toMatchObject({ ok: true })
  })

  it("single-step all-CLI chain preserves route_used: cli from executeTask delegation", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    getOperationCardMock.mockReturnValue(cliCard)
    executeMock.mockResolvedValue({
      ok: true,
      data: { id: "cli-single" },
      meta: { route_used: "cli" as const },
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [{ task: "issue.list", input: { owner: "acme", name: "modkit" } }],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("success")
    expect(result.meta.route_used).toBe("cli")
    expect(result.results[0]).toMatchObject({ ok: true, data: { id: "cli-single" } })
  })

  it("drains in-flight CLI promises when Phase 1 resolution lookup fails", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    const gqlCard = {
      ...baseCard,
      graphql: {
        operationName: "IssueView",
        documentPath: "src/gql/operations/issue-view.graphql",
        resolution: {
          lookup: {
            operationName: "RepoLookup",
            documentPath: "src/gql/operations/repo-lookup.graphql",
            vars: { owner: "owner", name: "name" },
          },
          inject: [],
        },
      },
    }
    setupMixedChainMocks(cliCard, gqlCard)

    // CLI step fails — both steps end up failing
    executeMock.mockResolvedValue({
      ok: false,
      error: { code: "UNKNOWN", message: "cli network timeout", retryable: false },
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn().mockReturnValue("query RepoLookup { repository { id } }"),
      getMutationDocument: vi.fn(),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi
        .fn()
        .mockReturnValue({ document: "query Batch { step1: repository { id } }", variables: {} }),
      buildBatchMutation: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.view", input: { owner: "acme", name: "modkit" } },
      ],
      {
        githubClient: createGithubClient({
          query: vi.fn().mockRejectedValue(new Error("resolution batch network error")),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toBe("cli network timeout")
    expect(result.results[1]?.ok).toBe(false)
    expect(result.results[1]?.error?.message).toMatch("Phase 1 (resolution) failed")
  })

  it("returns partial when Phase 1 fails but CLI step succeeded", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    const gqlCard = {
      ...baseCard,
      graphql: {
        operationName: "IssueView",
        documentPath: "src/gql/operations/issue-view.graphql",
        resolution: {
          lookup: {
            operationName: "RepoLookup",
            documentPath: "src/gql/operations/repo-lookup.graphql",
            vars: { owner: "owner", name: "name" },
          },
          inject: [],
        },
      },
    }
    setupMixedChainMocks(cliCard, gqlCard)

    executeMock.mockResolvedValue({
      ok: true,
      data: { id: "cli-ok" },
      meta: { route_used: "cli" as const },
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn().mockReturnValue("query RepoLookup { repository { id } }"),
      getMutationDocument: vi.fn(),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi
        .fn()
        .mockReturnValue({ document: "query Batch { step1: repository { id } }", variables: {} }),
      buildBatchMutation: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.view", input: { owner: "acme", name: "modkit" } },
      ],
      {
        githubClient: createGithubClient({
          query: vi.fn().mockRejectedValue(new Error("resolution batch network error")),
        }),
      },
    )

    expect(result.status).toBe("partial")
    expect(result.results[0]).toMatchObject({ ok: true, data: { id: "cli-ok" } })
    expect(result.results[1]?.ok).toBe(false)
    expect(result.results[1]?.error?.message).toMatch("Phase 1 (resolution) failed")
  })

  it("Phase 1 drain: wraps rejected CLI step promise in error envelope", async () => {
    // Exercises the "rejected" branch (lines 509-524) in the Phase 1 drain loop.
    // executeTask rejects (unexpected internal error) while Phase 1 lookup also fails.
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    const gqlCard = {
      ...baseCard,
      graphql: {
        operationName: "IssueView",
        documentPath: "src/gql/operations/issue-view.graphql",
        resolution: {
          lookup: {
            operationName: "RepoLookup",
            documentPath: "src/gql/operations/repo-lookup.graphql",
            vars: { owner: "owner", name: "name" },
          },
          inject: [],
        },
      },
    }
    setupMixedChainMocks(cliCard, gqlCard)

    // CLI step promise rejects (not ok:false — actual promise rejection)
    executeMock.mockRejectedValue(new Error("unexpected internal failure"))

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn().mockReturnValue("query RepoLookup { repository { id } }"),
      getMutationDocument: vi.fn(),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi
        .fn()
        .mockReturnValue({ document: "query Batch { step1: repository { id } }", variables: {} }),
      buildBatchMutation: vi.fn(),
      extractRootFieldName: vi.fn().mockReturnValue(null),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.view", input: { owner: "acme", name: "modkit" } },
      ],
      {
        githubClient: createGithubClient({
          query: vi.fn().mockRejectedValue(new Error("phase 1 network error")),
        }),
      },
    )

    // Both steps failed: CLI promise rejected (wrapped in UNKNOWN), Phase 1 GQL failed
    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.code).toBe("UNKNOWN")
    expect(result.results[0]?.error?.message).toContain("unexpected internal failure")
    expect(result.results[1]?.ok).toBe(false)
    expect(result.results[1]?.error?.message).toContain("Phase 1 (resolution) failed")
  })

  it("Phase 1 drain: uses fallback error when CLI step resolves with ok:false and no error field", async () => {
    // Exercises the cliResult.error ?? fallback branch (lines 549-553) in Phase 1 assembly.
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    const gqlCard = {
      ...baseCard,
      graphql: {
        operationName: "IssueView",
        documentPath: "src/gql/operations/issue-view.graphql",
        resolution: {
          lookup: {
            operationName: "RepoLookup",
            documentPath: "src/gql/operations/repo-lookup.graphql",
            vars: { owner: "owner", name: "name" },
          },
          inject: [],
        },
      },
    }
    setupMixedChainMocks(cliCard, gqlCard)

    // CLI step resolves with ok:false but no error field
    executeMock.mockResolvedValue({
      ok: false,
      data: undefined,
      error: undefined,
      meta: { capability_id: "issue.list", route_used: "cli" },
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn().mockReturnValue("query RepoLookup { repository { id } }"),
      getMutationDocument: vi.fn(),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi
        .fn()
        .mockReturnValue({ document: "query Batch { step1: repository { id } }", variables: {} }),
      buildBatchMutation: vi.fn(),
      extractRootFieldName: vi.fn().mockReturnValue(null),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.view", input: { owner: "acme", name: "modkit" } },
      ],
      {
        githubClient: createGithubClient({
          query: vi.fn().mockRejectedValue(new Error("phase 1 network error")),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    // Fallback message used when cliResult.error is undefined
    expect(result.results[0]?.error?.message).toBe("CLI step failed")
    expect(result.results[1]?.ok).toBe(false)
  })

  it("handles executeTask throwing unexpectedly (rejected promise) for a CLI step in Phase 2", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    getOperationCardMock.mockReturnValue(cliCard)
    executeMock.mockRejectedValue(new Error("unexpected internal failure"))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]).toMatchObject({ ok: false })
    expect(result.results[0]?.error?.message).toBe("unexpected internal failure")
  })

  it("Phase 2 assembly: uses fallback error when CLI step resolves with ok:false and no error", async () => {
    // Exercises the cliResult.error ?? fallback branch (lines 726-729) in Phase 2 assembly.
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    const gqlCard = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    setupMixedChainMocks(cliCard, gqlCard)

    // CLI step resolves with ok:false but no error field
    executeMock.mockResolvedValue({
      ok: false,
      data: undefined,
      error: undefined,
      meta: { capability_id: "issue.list", route_used: "cli" },
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation Batch { step1: closeIssue { issue { id } } }",
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.close", input: { issueId: "I1" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: { step1: { closeIssue: { issue: { id: "I1" } } } },
            errors: undefined,
          }),
        }),
      },
    )

    expect(result.status).toBe("partial")
    expect(result.results[0]?.ok).toBe(false)
    // Fallback message used when cliResult.error is undefined
    expect(result.results[0]?.error?.message).toBe("CLI step failed")
    expect(result.results[1]?.ok).toBe(true)
  })
})

// ===========================================================================
// Input validation preflight
// ===========================================================================

describe("executeTasks — input validation preflight", () => {
  it("rejects chain when input fails schema validation", async () => {
    const cardWithSchema = {
      ...baseCard,
      input_schema: {
        type: "object",
        properties: { owner: { type: "string" }, name: { type: "string" } },
        required: ["owner", "name"],
      },
      graphql: {
        operationName: "RepoView",
        documentPath: "src/gql/operations/repo-view.graphql",
      },
    }

    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: vi.fn().mockReturnValue(cardWithSchema),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "repo.view", input: {} },
        { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toContain("Input validation failed")
    expect(result.results[1]?.ok).toBe(false)
  })
})

// ===========================================================================
// Phase 1 resolution failure
// ===========================================================================

describe("executeTasks — Phase 1 resolution failure", () => {
  it("marks all steps as failed when Phase 1 batch lookup query rejects", async () => {
    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "x",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "y",
            vars: { issueId: "issueId" },
          },
          inject: [],
        },
      },
    }
    getOperationCardMock.mockReturnValue(cardWithResolution)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn().mockReturnValue("query IssueLabelsLookup { node { id } }"),
      getMutationDocument: vi.fn(),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi
        .fn()
        .mockReturnValue({ document: "query { step0: node { id } }", variables: {} }),
      buildBatchMutation: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.labels.set", input: { issueId: "I1" } },
        { task: "issue.labels.set", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          query: vi.fn().mockRejectedValue(new Error("rate limit exceeded")),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toContain("Phase 1 (resolution) failed")
    expect(result.results[1]?.ok).toBe(false)
  })
})

// ===========================================================================
// Phase 2 inject error
// ===========================================================================

describe("executeTasks — Phase 2 inject error", () => {
  it("marks step as failed when applyInject throws during Phase 2", async () => {
    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "x",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "y",
            vars: { issueId: "issueId" },
          },
          inject: [
            {
              target: "labelIds",
              source: "map_array" as const,
              from_input: "labels",
              nodes_path: "repository.labels.nodes",
              match_field: "name",
              extract_field: "id",
            },
          ],
        },
      },
    }
    getOperationCardMock.mockReturnValue(cardWithResolution)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn().mockReturnValue("query IssueLabelsLookup { node { id } }"),
      getMutationDocument: vi
        .fn()
        .mockReturnValue("mutation IssueLabelsSet { updateIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi
        .fn()
        .mockReturnValue({ document: "query { step0: node { id } }", variables: {} }),
      buildBatchMutation: vi
        .fn()
        .mockReturnValue({ document: "mutation { step0: x { id } }", variables: {} }),
      extractRootFieldName: vi.fn().mockReturnValue(null),
    }))
    vi.doMock("@core/gql/resolve.js", () => ({
      applyInject: vi.fn().mockImplementation(() => {
        throw new Error("inject path resolution failed")
      }),
      buildMutationVars: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: { labels: { nodes: [] } },
      step1: { labels: { nodes: [] } },
    })
    const queryRawMock = vi.fn().mockResolvedValue({ data: {}, errors: undefined })

    const result = await executeTasks(
      [
        { task: "issue.labels.set", input: { issueId: "I1", labels: ["bug"] } },
        { task: "issue.labels.set", input: { issueId: "I2", labels: ["bug"] } },
      ],
      {
        githubClient: createGithubClient({ query: queryMock, queryRaw: queryRawMock }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toContain("inject path resolution failed")
  })
})

// ===========================================================================
// Phase 2 null/missing data response
// ===========================================================================

describe("executeTasks — Phase 2 null/missing data response", () => {
  it("returns missing-alias error when data is null (falls through to empty {})", async () => {
    const card = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "x",
      },
    }
    getOperationCardMock.mockReturnValue(card)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi.fn().mockReturnValue("mutation IssueClose { closeIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation { step0: closeIssue { id } step1: closeIssue { id } }",
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: null,
            errors: undefined,
          }),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toContain("missing mutation result")
  })
})

// ===========================================================================
// Resolution cache population
// ===========================================================================

describe("executeTasks — resolution cache population", () => {
  it("populates resolution cache during Phase 1 and verifies entries", async () => {
    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "x",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "y",
            vars: { issueId: "issueId" },
          },
          inject: [
            {
              target: "labelIds",
              source: "map_array" as const,
              from_input: "labels",
              nodes_path: "repository.labels.nodes",
              match_field: "name",
              extract_field: "id",
            },
          ],
        },
      },
    }
    getOperationCardMock.mockReturnValue(cardWithResolution)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi
        .fn()
        .mockReturnValue("query IssueLabelsLookup($issueId: ID!) { node(id: $issueId) { id } }"),
      getMutationDocument: vi
        .fn()
        .mockReturnValue("mutation IssueLabelsSet { updateIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi.fn().mockReturnValue({
        document: "query { step0: node { id } step1: node { id } }",
        variables: {},
      }),
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation { step0: updateIssue { id } step1: updateIssue { id } }",
        variables: {},
      }),
      extractRootFieldName: vi.fn().mockReturnValue("node"),
    }))
    vi.doMock("@core/gql/resolve.js", () => ({
      applyInject: vi.fn().mockReturnValue({ labelIds: ["L1"] }),
      buildMutationVars: vi
        .fn()
        .mockImplementation(
          (_doc: string, input: Record<string, unknown>, resolved: Record<string, unknown>) => ({
            ...input,
            ...resolved,
          }),
        ),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")
    const { createResolutionCache } = await import("@core/core/routing/resolution-cache.js")

    const cache = createResolutionCache()
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: { labels: { nodes: [{ id: "L1", name: "bug" }] } },
      step1: { labels: { nodes: [{ id: "L1", name: "bug" }] } },
    })
    const queryRawMock = vi.fn().mockResolvedValue({
      data: {
        step0: { updateIssue: { id: "I1" } },
        step1: { updateIssue: { id: "I2" } },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        { task: "issue.labels.set", input: { issueId: "I1", labels: ["bug"] } },
        { task: "issue.labels.set", input: { issueId: "I2", labels: ["bug"] } },
      ],
      {
        githubClient: createGithubClient({ query: queryMock, queryRaw: queryRawMock }),
        resolutionCache: cache,
      },
    )

    expect(result.status).toBe("success")
    expect(cache.size).toBe(2)
  })
})

// ===========================================================================
// Phase 2 pre-result error path (buildMutationVars throws for one step)
// ===========================================================================

describe("executeTasks — Phase 2 buildMutationVars error", () => {
  it("records pre-result error for step where buildMutationVars throws, other step succeeds", async () => {
    const card = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "x",
      },
    }
    getOperationCardMock.mockReturnValue(card)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi.fn().mockReturnValue("mutation IssueClose { closeIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation { step1: closeIssue { id } }",
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))
    vi.doMock("@core/gql/resolve.js", () => ({
      applyInject: vi.fn(),
      // buildMutationVars throws for step 0, succeeds for step 1
      buildMutationVars: vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error("vars build failed")
        })
        .mockReturnValueOnce({ issueId: "I2" }),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: { step1: { closeIssue: { issue: { id: "I2" } } } },
            errors: undefined,
          }),
        }),
      },
    )

    // step 0: pre-result error (buildMutationVars threw)
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toContain("vars build failed")
    // step 1: mutation alias "step1" found → success
    expect(result.results[1]?.ok).toBe(true)
    expect(result.status).toBe("partial")
  })

  it("records pre-result error from non-Error thrown in buildMutationVars (String path)", async () => {
    // Exercises the `err instanceof Error ? ... : String(err)` false branch at line 617.
    const card = {
      ...baseCard,
      graphql: { operationName: "IssueClose", documentPath: "x" },
    }
    getOperationCardMock.mockReturnValue(card)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi.fn().mockReturnValue("mutation IssueClose { closeIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation { step1: closeIssue { id } }",
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))
    vi.doMock("@core/gql/resolve.js", () => ({
      applyInject: vi.fn(),
      buildMutationVars: vi
        .fn()
        .mockImplementationOnce(() => {
          throw "non-Error string reason"
        })
        .mockReturnValueOnce({ issueId: "I2" }),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: { step1: { closeIssue: { issue: { id: "I2" } } } },
            errors: undefined,
          }),
        }),
      },
    )

    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toBe("non-Error string reason")
    expect(result.results[1]?.ok).toBe(true)
  })
})

// ===========================================================================
// Branch coverage — non-Error thrown paths
// ===========================================================================

describe("executeTasks — non-Error thrown paths", () => {
  it("encodes string thrown from preflight card lookup as error message (String path)", async () => {
    // Exercises `err instanceof Error ? err.message : String(err)` false branch (line 341)
    // when the error caught in the pre-flight loop is not an Error instance.
    const validCard = {
      ...baseCard,
      graphql: { operationName: "IssueClose", documentPath: "x" },
    }
    getOperationCardMock
      .mockReturnValueOnce(validCard) // step 0: passes pre-flight
      .mockImplementationOnce(() => {
        throw "non-Error from getOperationCard"
      }) // step 1: throws non-Error

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: {} },
        { task: "issue.view", input: {} },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.results[1]?.ok).toBe(false)
    expect(result.results[1]?.error?.message).toBe("non-Error from getOperationCard")
  })

  it("uses cli route_used when only CLI-only cards pass preflight and a later step fails", async () => {
    // Exercises `!anyGqlCard && cards.length > 0 ? "cli" : "graphql"` true branch (line 353).
    const cliOnlyCard = { ...baseCard, cli: { command: "gh issue list" } }
    getOperationCardMock
      .mockReturnValueOnce(cliOnlyCard) // step 0: CLI-only, passes pre-flight
      .mockReturnValueOnce(null) // step 1: no card → pre-flight fails

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: {} },
        { task: "invalid.task", input: {} },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.meta.route_used).toBe("cli")
  })

  it("Phase 1 drain: encodes non-Error rejection reason as string (String path)", async () => {
    // Exercises `outcome.reason instanceof Error ? ... : String(outcome.reason)` false branch
    // at line 512 in the Phase 1 drain loop.
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    const gqlCard = {
      ...baseCard,
      graphql: {
        operationName: "IssueView",
        documentPath: "x",
        resolution: {
          lookup: {
            operationName: "RepoLookup",
            documentPath: "y",
            vars: { owner: "owner", name: "name" },
          },
          inject: [],
        },
      },
    }
    setupMixedChainMocks(cliCard, gqlCard)

    // CLI step rejects with a non-Error (string)
    executeMock.mockRejectedValue("non-Error string rejection")

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn().mockReturnValue("query RepoLookup { repository { id } }"),
      getMutationDocument: vi.fn(),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi
        .fn()
        .mockReturnValue({ document: "query Batch { step1: repository { id } }", variables: {} }),
      buildBatchMutation: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.view", input: { owner: "acme", name: "modkit" } },
      ],
      {
        githubClient: createGithubClient({
          query: vi.fn().mockRejectedValue(new Error("phase 1 failed")),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toBe("non-Error string rejection")
  })

  it("Phase 1 failure: encodes non-Error query exception as string and marks retryable false", async () => {
    // Exercises `err instanceof Error ? err.message : String(err)` false branch at line 527
    // AND the isRetryableCode path reaching the Server check (line 114) for UNKNOWN code.
    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "x",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "y",
            vars: { issueId: "issueId" },
          },
          inject: [],
        },
      },
    }
    getOperationCardMock.mockReturnValue(cardWithResolution)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn().mockReturnValue("query IssueLabelsLookup { node { id } }"),
      getMutationDocument: vi.fn(),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi
        .fn()
        .mockReturnValue({ document: "query { step0: node { id } }", variables: {} }),
      buildBatchMutation: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    // githubClient.query rejects with a non-Error string → String(err) path + UNKNOWN code
    const result = await executeTasks(
      [
        { task: "issue.labels.set", input: { issueId: "I1" } },
        { task: "issue.labels.set", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          query: vi.fn().mockRejectedValue("non-Error query rejection"),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.error?.message).toContain("non-Error query rejection")
    // retryable should be false because UNKNOWN code is not retryable
    expect(result.results[0]?.error?.retryable).toBe(false)
  })

  it("Phase 2 transport failure: encodes non-Error rejection as string in step errors", async () => {
    // Exercises `err instanceof Error ? err.message : String(err)` false branch at line 672
    // in the Phase 2 batch mutation transport failure handler.
    const card = {
      ...baseCard,
      graphql: { operationName: "IssueClose", documentPath: "x" },
    }
    getOperationCardMock.mockReturnValue(card)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi.fn().mockReturnValue("mutation IssueClose { closeIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation { step0: closeIssue { id } step1: closeIssue { id } }",
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockRejectedValue("non-Error transport failure"),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toBe("non-Error transport failure")
  })

  it("Phase 2 unattributed error: uses GraphQL batch error fallback when message is absent", async () => {
    // Exercises `rawResponse.errors[0]?.message ?? "GraphQL batch error"` null-coalescing
    // false branch at line 653.
    const card = {
      ...baseCard,
      graphql: { operationName: "IssueClose", documentPath: "x" },
    }
    getOperationCardMock.mockReturnValue(card)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi.fn().mockReturnValue("mutation IssueClose { closeIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation { step0: closeIssue { id } step1: closeIssue { id } }",
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          // Error with no path and no message field → falls back to "GraphQL batch error"
          queryRaw: vi
            .fn()
            .mockResolvedValue({ data: {}, errors: [{ path: undefined }] as unknown[] }),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toBe("GraphQL batch error")
    expect(result.results[1]?.ok).toBe(false)
    expect(result.results[1]?.error?.message).toBe("GraphQL batch error")
  })

  it("Phase 2 CLI collect: encodes non-Error rejection reason as string", async () => {
    // Exercises `outcome.reason instanceof Error ? ... : String(outcome.reason)` false branch
    // at line 706 in the Phase 2 CLI step result collection loop.
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    getOperationCardMock.mockReturnValue(cliCard)

    // CLI step rejects with a non-Error string
    executeMock.mockRejectedValue("non-Error Phase 2 rejection")

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: {} },
        { task: "issue.list", input: {} },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toBe("non-Error Phase 2 rejection")
  })
})

// ===========================================================================
// Branch coverage — invariant guards with undefined array elements
// ===========================================================================

describe("executeTasks — invariant guard with undefined request element", () => {
  it("skips undefined element in pre-flight loop then throws on CLI dispatch invariant", async () => {
    // Array with undefined at index 0 covers:
    //   line 301: `if (req === undefined) continue` true branch
    //   line 389-391: invariant throw when cards[0] exists but requests[0] is undefined
    const cliOnlyCard = { ...baseCard, cli: { command: "gh issue list" } }
    // getOperationCard is called for requests[1] only (requests[0] is undefined → skipped)
    getOperationCardMock.mockReturnValue(cliOnlyCard)

    const { executeTasks } = await import("@core/core/routing/engine.js")

    await expect(
      executeTasks(
        [undefined, { task: "issue.list", input: {} }] as unknown as Array<{
          task: string
          input: Record<string, unknown>
        }>,
        { githubClient: createGithubClient() },
      ),
    ).rejects.toThrow("invariant violated")
  })
})
