import type { OperationCard } from "@core/core/registry/types.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { baseCard, createGithubClient } from "../helpers/engine-fixtures.js"

// Module-level mocks — re-registered after each vi.resetModules()
const buildBatchMutationMock = vi.fn()
const buildBatchQueryMock = vi.fn()
const getDocumentMock = vi.fn()
const applyInjectMock = vi.fn()
const buildOperationVarsMock = vi.fn()
const loggerDebugMock = vi.fn()
const loggerErrorMock = vi.fn()
const loggerInfoMock = vi.fn()
const mapErrorToCodeMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  buildBatchMutationMock.mockReset()
  buildBatchQueryMock.mockReset()
  getDocumentMock.mockReset()
  applyInjectMock.mockReset()
  buildOperationVarsMock.mockReset()
  loggerDebugMock.mockReset()
  loggerErrorMock.mockReset()
  loggerInfoMock.mockReset()
  mapErrorToCodeMock.mockReset()

  // Default mock implementations
  buildBatchMutationMock.mockReturnValue({ document: "mutation { stub }", variables: {} })
  buildBatchQueryMock.mockReturnValue({ document: "query { stub }", variables: {} })
  getDocumentMock.mockReturnValue("query { repo { id } }")
  applyInjectMock.mockReturnValue({})
  buildOperationVarsMock.mockImplementation(
    (_doc: unknown, input: Record<string, unknown>, resolved: Record<string, unknown>) => ({
      ...input,
      ...resolved,
    }),
  )

  vi.doMock("@core/gql/batch.js", () => ({
    buildBatchMutation: (...args: unknown[]) => buildBatchMutationMock(...args),
    buildBatchQuery: (...args: unknown[]) => buildBatchQueryMock(...args),
  }))
  vi.doMock("@core/gql/document-registry.js", () => ({
    getDocument: (...args: unknown[]) => getDocumentMock(...args),
  }))
  vi.doMock("@core/gql/resolve.js", () => ({
    applyInject: (...args: unknown[]) => applyInjectMock(...args),
    buildOperationVars: (...args: unknown[]) => buildOperationVarsMock(...args),
  }))
  vi.doMock("@core/core/telemetry/log.js", () => ({
    logger: {
      debug: (...args: unknown[]) => loggerDebugMock(...args),
      error: (...args: unknown[]) => loggerErrorMock(...args),
      info: (...args: unknown[]) => loggerInfoMock(...args),
    },
  }))
  vi.doMock("@core/core/errors/map-error.js", () => ({
    mapErrorToCode: (...args: unknown[]) => mapErrorToCodeMock(...args),
  }))
})

async function importRunGqlExecutePhase() {
  const mod = await import("@core/core/routing/engine/execute.js")
  return mod.runGqlExecutePhase
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMutationCard(): OperationCard {
  return {
    ...baseCard,
    graphql: {
      operationName: "IssueCreate",
      operationType: "mutation",
      documentPath: "src/gql/operations/IssueCreate.graphql",
    },
  }
}

function makeQueryCard(): OperationCard {
  return {
    ...baseCard,
    graphql: {
      operationName: "IssueList",
      operationType: "query",
      documentPath: "src/gql/operations/IssueList.graphql",
    },
  }
}

// ===========================================================================
// Input building
// ===========================================================================

describe("runGqlExecutePhase — input building", () => {
  it("routes mutation steps to mutationInputs and calls buildBatchMutation", async () => {
    const runGqlExecutePhase = await importRunGqlExecutePhase()
    const card = makeMutationCard()
    const client = createGithubClient({
      queryRaw: vi.fn().mockResolvedValue({ data: { step0: { id: "1" } }, errors: undefined }),
    })

    const steps = [
      { route: "gql-mutation" as const, card, index: 0, request: { task: "t", input: {} } },
    ]
    const requests = [{ task: "t", input: { owner: "acme" } }]

    await runGqlExecutePhase(steps, requests, {}, { githubClient: client })

    expect(buildBatchMutationMock).toHaveBeenCalledOnce()
    expect(buildBatchQueryMock).not.toHaveBeenCalled()
  })

  it("routes query steps to queryInputs and calls buildBatchQuery", async () => {
    const runGqlExecutePhase = await importRunGqlExecutePhase()
    const card = makeQueryCard()
    const client = createGithubClient({
      query: vi.fn().mockResolvedValue({ step0: { nodes: [] } }),
    })

    const steps = [
      { route: "gql-query" as const, card, index: 0, request: { task: "t", input: {} } },
    ]
    const requests = [{ task: "t", input: { owner: "acme" } }]

    await runGqlExecutePhase(steps, requests, {}, { githubClient: client })

    expect(buildBatchQueryMock).toHaveBeenCalledOnce()
    expect(buildBatchMutationMock).not.toHaveBeenCalled()
  })

  it("records a stepError when card has no graphql config", async () => {
    const runGqlExecutePhase = await importRunGqlExecutePhase()
    const cardNoGql = { ...baseCard } as unknown as OperationCard
    const client = createGithubClient()

    const steps = [
      {
        route: "gql-mutation" as const,
        card: cardNoGql,
        index: 0,
        request: { task: "t", input: {} },
      },
    ]
    const requests = [{ task: "t", input: {} }]

    const result = await runGqlExecutePhase(steps, requests, {}, { githubClient: client })

    expect(result.stepErrors.get("step0")).toMatch(/no graphql config/)
    expect(buildBatchMutationMock).not.toHaveBeenCalled()
  })

  it("skips a step when the corresponding request is missing (undefined)", async () => {
    const runGqlExecutePhase = await importRunGqlExecutePhase()
    const card = makeMutationCard()
    const client = createGithubClient()

    // step.index = 1 but requests only has index 0
    const steps = [
      { route: "gql-mutation" as const, card, index: 1, request: { task: "t", input: {} } },
    ]
    const requests = [{ task: "t", input: {} }]

    const result = await runGqlExecutePhase(steps, requests, {}, { githubClient: client })

    expect(result.stepErrors.size).toBe(0)
    expect(buildBatchMutationMock).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Mutation dispatch
// ===========================================================================

describe("runGqlExecutePhase — mutation dispatch", () => {
  it("populates mutationRawResult from rawResponse.data on success", async () => {
    const runGqlExecutePhase = await importRunGqlExecutePhase()
    const card = makeMutationCard()
    const responseData = { step0: { id: "issue-42" } }
    const client = createGithubClient({
      queryRaw: vi.fn().mockResolvedValue({ data: responseData, errors: undefined }),
    })

    const steps = [
      { route: "gql-mutation" as const, card, index: 0, request: { task: "t", input: {} } },
    ]
    const requests = [{ task: "t", input: { owner: "acme" } }]

    const result = await runGqlExecutePhase(steps, requests, {}, { githubClient: client })

    expect(result.mutationRawResult).toEqual(responseData)
    expect(result.stepErrors.size).toBe(0)
  })

  it("maps batch errors with path ['step0'] to stepErrors", async () => {
    const runGqlExecutePhase = await importRunGqlExecutePhase()
    const card = makeMutationCard()
    const client = createGithubClient({
      queryRaw: vi.fn().mockResolvedValue({
        data: {},
        errors: [{ message: "resource not found", path: ["step0"] }],
      }),
    })

    const steps = [
      { route: "gql-mutation" as const, card, index: 0, request: { task: "t", input: {} } },
    ]
    const requests = [{ task: "t", input: {} }]

    const result = await runGqlExecutePhase(steps, requests, {}, { githubClient: client })

    expect(result.stepErrors.get("step0")).toBe("resource not found")
  })

  it("maps all mutation aliases when errors have no matching step path", async () => {
    const runGqlExecutePhase = await importRunGqlExecutePhase()
    const card = makeMutationCard()
    const client = createGithubClient({
      queryRaw: vi.fn().mockResolvedValue({
        data: {},
        errors: [{ message: "batch failed", path: ["unrelated"] }],
      }),
    })

    const steps = [
      { route: "gql-mutation" as const, card, index: 0, request: { task: "t", input: {} } },
    ]
    const requests = [{ task: "t", input: {} }]

    const result = await runGqlExecutePhase(steps, requests, {}, { githubClient: client })

    expect(result.stepErrors.get("step0")).toBe("batch failed")
  })

  it("adds all mutation aliases to stepErrors when queryRaw throws", async () => {
    const runGqlExecutePhase = await importRunGqlExecutePhase()
    const card = makeMutationCard()
    const client = createGithubClient({
      queryRaw: vi.fn().mockRejectedValue(new Error("network error")),
    })

    const steps = [
      { route: "gql-mutation" as const, card, index: 0, request: { task: "t", input: {} } },
    ]
    const requests = [{ task: "t", input: {} }]

    const result = await runGqlExecutePhase(steps, requests, {}, { githubClient: client })

    expect(result.stepErrors.get("step0")).toBe("network error")
  })

  it("returns empty mutationRawResult when there are no mutation steps", async () => {
    const runGqlExecutePhase = await importRunGqlExecutePhase()
    const card = makeQueryCard()
    const client = createGithubClient({
      query: vi.fn().mockResolvedValue({}),
    })

    const steps = [
      { route: "gql-query" as const, card, index: 0, request: { task: "t", input: {} } },
    ]
    const requests = [{ task: "t", input: {} }]

    const result = await runGqlExecutePhase(steps, requests, {}, { githubClient: client })

    expect(result.mutationRawResult).toEqual({})
    expect(buildBatchMutationMock).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Query dispatch
// ===========================================================================

describe("runGqlExecutePhase — query dispatch", () => {
  it("populates queryRawResult from query result on success", async () => {
    const runGqlExecutePhase = await importRunGqlExecutePhase()
    const card = makeQueryCard()
    const queryResult = { step0: { nodes: [{ id: "issue-1" }] } }
    const client = createGithubClient({
      query: vi.fn().mockResolvedValue(queryResult),
    })

    const steps = [
      { route: "gql-query" as const, card, index: 0, request: { task: "t", input: {} } },
    ]
    const requests = [{ task: "t", input: { owner: "acme" } }]

    const result = await runGqlExecutePhase(steps, requests, {}, { githubClient: client })

    expect(result.queryRawResult).toEqual(queryResult)
    expect(result.stepErrors.size).toBe(0)
  })

  it("adds all query aliases to stepErrors when query throws", async () => {
    const runGqlExecutePhase = await importRunGqlExecutePhase()
    const card = makeQueryCard()
    const client = createGithubClient({
      query: vi.fn().mockRejectedValue(new Error("timeout")),
    })

    const steps = [
      { route: "gql-query" as const, card, index: 0, request: { task: "t", input: {} } },
    ]
    const requests = [{ task: "t", input: {} }]

    const result = await runGqlExecutePhase(steps, requests, {}, { githubClient: client })

    expect(result.stepErrors.get("step0")).toBe("timeout")
  })

  it("returns empty queryRawResult when there are no query steps", async () => {
    const runGqlExecutePhase = await importRunGqlExecutePhase()
    const card = makeMutationCard()
    const client = createGithubClient({
      queryRaw: vi.fn().mockResolvedValue({ data: {}, errors: undefined }),
    })

    const steps = [
      { route: "gql-mutation" as const, card, index: 0, request: { task: "t", input: {} } },
    ]
    const requests = [{ task: "t", input: {} }]

    const result = await runGqlExecutePhase(steps, requests, {}, { githubClient: client })

    expect(result.queryRawResult).toEqual({})
    expect(buildBatchQueryMock).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Combined
// ===========================================================================

describe("runGqlExecutePhase — combined mutation + query", () => {
  it("dispatches mutation and query concurrently and returns both results", async () => {
    const runGqlExecutePhase = await importRunGqlExecutePhase()
    const mutationCard = makeMutationCard()
    const queryCard = makeQueryCard()

    const mutationData = { step0: { id: "new-issue" } }
    const queryData = { step1: { nodes: [{ id: "existing-issue" }] } }

    const queryRawMock = vi.fn().mockResolvedValue({ data: mutationData, errors: undefined })
    const queryMock = vi.fn().mockResolvedValue(queryData)

    const client = createGithubClient({
      queryRaw: queryRawMock,
      query: queryMock,
    })

    const steps = [
      {
        route: "gql-mutation" as const,
        card: mutationCard,
        index: 0,
        request: { task: "t", input: {} },
      },
      { route: "gql-query" as const, card: queryCard, index: 1, request: { task: "t", input: {} } },
    ]
    const requests = [
      { task: "t", input: { owner: "acme" } },
      { task: "t", input: { owner: "acme" } },
    ]

    const result = await runGqlExecutePhase(steps, requests, {}, { githubClient: client })

    expect(result.mutationRawResult).toEqual(mutationData)
    expect(result.queryRawResult).toEqual(queryData)
    expect(result.stepErrors.size).toBe(0)
    expect(queryRawMock).toHaveBeenCalledOnce()
    expect(queryMock).toHaveBeenCalledOnce()
  })
})
