import type { ResultEnvelope } from "@core/core/contracts/envelope.js"
import { errorCodes } from "@core/core/errors/codes.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Static mocks — pure functions, no module-level state to reset
vi.mock("@core/core/telemetry/log.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock("@core/core/errors/map-error.js", () => ({
  mapErrorToCode: vi.fn((error: unknown) => {
    const msg = String(error)
    if (msg.includes("rate limit") || msg.includes("rate_limit")) return errorCodes.RateLimit
    return errorCodes.Unknown
  }),
}))

import { mapErrorToCode } from "@core/core/errors/map-error.js"
import type { AssembleInput } from "@core/core/routing/engine/assemble.js"
import {
  assembleChainResult,
  assembleResolutionFailure,
  isRetryableCode,
} from "@core/core/routing/engine/assemble.js"
import type { ClassifiedStep } from "@core/core/routing/engine/types.js"
import { baseCard } from "../helpers/engine-fixtures.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(task = "repo.view") {
  return { task, input: {} as Record<string, unknown> }
}

function makeGqlQueryStep(index: number): ClassifiedStep {
  return { route: "gql-query", card: baseCard, index, request: makeRequest() }
}

function makeGqlMutationStep(index: number): ClassifiedStep {
  return { route: "gql-mutation", card: baseCard, index, request: makeRequest() }
}

function makeCliStep(index: number): ClassifiedStep {
  return { route: "cli", card: baseCard, index, request: makeRequest() }
}

function makeSuccessEnvelope(data: unknown = { id: 1 }): ResultEnvelope {
  return {
    ok: true,
    data,
    meta: { capability_id: "repo.view", route_used: "cli" },
  }
}

function baseAssembleInput(overrides: Partial<AssembleInput> = {}): AssembleInput {
  return {
    steps: [],
    requests: [],
    mutationRawResult: {},
    queryRawResult: {},
    stepErrors: new Map(),
    cliResults: new Map(),
    cliStepCount: 0,
    batchStartMs: Date.now(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// isRetryableCode
// ---------------------------------------------------------------------------

describe("isRetryableCode", () => {
  it("returns true for RateLimit code", () => {
    expect(isRetryableCode(errorCodes.RateLimit)).toBe(true)
  })

  it("returns true for Network code", () => {
    expect(isRetryableCode(errorCodes.Network)).toBe(true)
  })

  it("returns true for Server code", () => {
    expect(isRetryableCode(errorCodes.Server)).toBe(true)
  })

  it("returns false for Unknown code", () => {
    expect(isRetryableCode(errorCodes.Unknown)).toBe(false)
  })

  it("returns false for an arbitrary unknown string", () => {
    expect(isRetryableCode("SOME_OTHER_CODE")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// assembleChainResult
// ---------------------------------------------------------------------------

describe("assembleChainResult", () => {
  beforeEach(() => {
    vi.mocked(mapErrorToCode).mockImplementation((error: unknown) => {
      const msg = String(error)
      if (msg.includes("rate limit") || msg.includes("rate_limit")) return errorCodes.RateLimit
      return errorCodes.Unknown
    })
  })

  it("all steps succeed via mutation raw result — status success, route_used graphql", () => {
    const requests = [makeRequest("issue.create"), makeRequest("issue.create")]
    const steps = [makeGqlMutationStep(0), makeGqlMutationStep(1)]
    const input = baseAssembleInput({
      steps,
      requests,
      mutationRawResult: { step0: { id: 10 }, step1: { id: 11 } },
      cliStepCount: 0,
    })

    const result = assembleChainResult(input)

    expect(result.status).toBe("success")
    expect(result.meta.route_used).toBe("graphql")
    expect(result.meta.total).toBe(2)
    expect(result.meta.succeeded).toBe(2)
    expect(result.meta.failed).toBe(0)
    expect(result.results[0]).toMatchObject({ ok: true, data: { id: 10 } })
    expect(result.results[1]).toMatchObject({ ok: true, data: { id: 11 } })
  })

  it("all steps succeed via query raw result — status success", () => {
    const requests = [makeRequest("repo.view"), makeRequest("issue.list")]
    const steps = [makeGqlQueryStep(0), makeGqlQueryStep(1)]
    const input = baseAssembleInput({
      steps,
      requests,
      queryRawResult: { step0: { name: "repo" }, step1: [{ id: 1 }] },
      cliStepCount: 0,
    })

    const result = assembleChainResult(input)

    expect(result.status).toBe("success")
    expect(result.results[0]).toMatchObject({ ok: true, data: { name: "repo" } })
    expect(result.results[1]).toMatchObject({ ok: true, data: [{ id: 1 }] })
  })

  it("one step fails via stepErrors — ok: false with correct code and message", () => {
    const requests = [makeRequest("repo.view"), makeRequest("issue.list")]
    const steps = [makeGqlQueryStep(0), makeGqlQueryStep(1)]
    const stepErrors = new Map<string, string>([["step0", "not authorized"]])
    const input = baseAssembleInput({
      steps,
      requests,
      queryRawResult: { step1: [{ id: 1 }] },
      stepErrors,
      cliStepCount: 0,
    })

    const result = assembleChainResult(input)

    expect(result.results[0]).toMatchObject({
      ok: false,
      error: { message: "not authorized" },
    })
    expect(result.results[1]).toMatchObject({ ok: true })
  })

  it("all steps fail — status failed", () => {
    const requests = [makeRequest("repo.view"), makeRequest("issue.list")]
    const steps = [makeGqlQueryStep(0), makeGqlQueryStep(1)]
    const stepErrors = new Map<string, string>([
      ["step0", "error A"],
      ["step1", "error B"],
    ])
    const input = baseAssembleInput({ steps, requests, stepErrors, cliStepCount: 0 })

    const result = assembleChainResult(input)

    expect(result.status).toBe("failed")
    expect(result.meta.failed).toBe(2)
    expect(result.meta.succeeded).toBe(0)
  })

  it("mixed success and failure — status partial", () => {
    const requests = [makeRequest("repo.view"), makeRequest("issue.list")]
    const steps = [makeGqlQueryStep(0), makeGqlQueryStep(1)]
    const stepErrors = new Map<string, string>([["step0", "some error"]])
    const input = baseAssembleInput({
      steps,
      requests,
      queryRawResult: { step1: { ok: true } },
      stepErrors,
      cliStepCount: 0,
    })

    const result = assembleChainResult(input)

    expect(result.status).toBe("partial")
    expect(result.meta.succeeded).toBe(1)
    expect(result.meta.failed).toBe(1)
  })

  it("CLI step success — uses cliResult.data", () => {
    const requests = [makeRequest("issue.list")]
    const steps = [makeCliStep(0)]
    const cliResults = new Map([[0, makeSuccessEnvelope({ items: [] })]])
    const input = baseAssembleInput({
      steps,
      requests,
      cliResults,
      cliStepCount: 1,
    })

    const result = assembleChainResult(input)

    expect(result.status).toBe("success")
    expect(result.results[0]).toMatchObject({ ok: true, data: { items: [] } })
  })

  it("CLI step failure — uses cliResult.error", () => {
    const requests = [makeRequest("issue.list")]
    const steps = [makeCliStep(0)]
    const cliError = { code: errorCodes.NotFound, message: "not found", retryable: false }
    const envelope: ResultEnvelope = {
      ok: false,
      error: cliError,
      meta: { capability_id: "issue.list", route_used: "cli" },
    }
    const cliResults = new Map([[0, envelope]])
    const input = baseAssembleInput({
      steps,
      requests,
      cliResults,
      cliStepCount: 1,
    })

    const result = assembleChainResult(input)

    expect(result.results[0]).toMatchObject({ ok: false, error: cliError })
  })

  it("CLI step failure with no error field — falls back to default error", () => {
    const requests = [makeRequest("issue.list")]
    const steps = [makeCliStep(0)]
    const envelope: ResultEnvelope = {
      ok: false,
      meta: { capability_id: "issue.list", route_used: "cli" },
    }
    const cliResults = new Map([[0, envelope]])
    const input = baseAssembleInput({
      steps,
      requests,
      cliResults,
      cliStepCount: 1,
    })

    const result = assembleChainResult(input)

    expect(result.results[0]).toMatchObject({
      ok: false,
      error: { code: errorCodes.Unknown, message: "CLI step failed", retryable: false },
    })
  })

  it("missing alias in both raw results — error with 'missing result for alias stepN'", () => {
    const requests = [makeRequest("repo.view")]
    const steps = [makeGqlQueryStep(0)]
    const input = baseAssembleInput({ steps, requests, cliStepCount: 0 })

    const result = assembleChainResult(input)

    expect(result.results[0]).toMatchObject({
      ok: false,
      error: {
        code: errorCodes.Unknown,
        message: "missing result for alias step0",
        retryable: false,
      },
    })
  })

  it("missing mutation alias — error with 'missing mutation result for alias stepN'", () => {
    const requests = [makeRequest("issue.create")]
    const steps = [makeGqlMutationStep(0)]
    const input = baseAssembleInput({ steps, requests, cliStepCount: 0 })

    const result = assembleChainResult(input)

    expect(result.results[0]).toMatchObject({
      ok: false,
      error: {
        code: errorCodes.Unknown,
        message: "missing mutation result for alias step0",
        retryable: false,
      },
    })
  })

  it("all steps are CLI-only — route_used cli", () => {
    const requests = [makeRequest("issue.list"), makeRequest("pr.list")]
    const steps = [makeCliStep(0), makeCliStep(1)]
    const cliResults = new Map([
      [0, makeSuccessEnvelope({ items: [] })],
      [1, makeSuccessEnvelope({ prs: [] })],
    ])
    const input = baseAssembleInput({
      steps,
      requests,
      cliResults,
      cliStepCount: 2,
    })

    const result = assembleChainResult(input)

    expect(result.meta.route_used).toBe("cli")
  })

  it("mixed CLI + GQL steps — route_used graphql", () => {
    const requests = [makeRequest("issue.list"), makeRequest("issue.create")]
    const steps = [makeCliStep(0), makeGqlMutationStep(1)]
    const cliResults = new Map([[0, makeSuccessEnvelope({ items: [] })]])
    const input = baseAssembleInput({
      steps,
      requests,
      mutationRawResult: { step1: { id: 42 } },
      cliResults,
      cliStepCount: 1,
    })

    const result = assembleChainResult(input)

    expect(result.meta.route_used).toBe("graphql")
  })

  it("stepErrors produces retryable: true for rate-limit messages", () => {
    vi.mocked(mapErrorToCode).mockReturnValueOnce(errorCodes.RateLimit)

    const requests = [makeRequest("repo.view")]
    const steps = [makeGqlQueryStep(0)]
    const stepErrors = new Map<string, string>([["step0", "rate limit exceeded"]])
    const input = baseAssembleInput({ steps, requests, stepErrors, cliStepCount: 0 })

    const result = assembleChainResult(input)

    expect(result.results[0]).toMatchObject({
      ok: false,
      error: { code: errorCodes.RateLimit, retryable: true },
    })
  })
})

// ---------------------------------------------------------------------------
// assembleResolutionFailure
// ---------------------------------------------------------------------------

describe("assembleResolutionFailure", () => {
  const phase1Error = {
    code: errorCodes.Auth,
    message: "authentication failed",
    retryable: false,
  }

  it("all GQL steps — all fail with phase1Error", () => {
    const requests = [makeRequest("repo.view"), makeRequest("issue.list")]
    const steps = [makeGqlQueryStep(0), makeGqlQueryStep(1)]

    const result = assembleResolutionFailure(requests, steps, phase1Error, new Map())

    expect(result.status).toBe("failed")
    expect(result.results[0]).toMatchObject({ ok: false, error: phase1Error })
    expect(result.results[1]).toMatchObject({ ok: false, error: phase1Error })
  })

  it("CLI step succeeds — kept as success; GQL step gets phase1Error", () => {
    const requests = [makeRequest("issue.list"), makeRequest("repo.view")]
    const steps = [makeCliStep(0), makeGqlQueryStep(1)]
    const cliResults = new Map([[0, makeSuccessEnvelope({ items: [] })]])

    const result = assembleResolutionFailure(requests, steps, phase1Error, cliResults)

    expect(result.status).toBe("partial")
    expect(result.results[0]).toMatchObject({ ok: true, data: { items: [] } })
    expect(result.results[1]).toMatchObject({ ok: false, error: phase1Error })
  })

  it("CLI step fails — kept as failure with its error; GQL step gets phase1Error", () => {
    const requests = [makeRequest("issue.list"), makeRequest("repo.view")]
    const steps = [makeCliStep(0), makeGqlQueryStep(1)]
    const cliError = { code: errorCodes.NotFound, message: "not found", retryable: false }
    const failEnvelope: ResultEnvelope = {
      ok: false,
      error: cliError,
      meta: { capability_id: "issue.list", route_used: "cli" },
    }
    const cliResults = new Map([[0, failEnvelope]])

    const result = assembleResolutionFailure(requests, steps, phase1Error, cliResults)

    expect(result.status).toBe("failed")
    expect(result.results[0]).toMatchObject({ ok: false, error: cliError })
    expect(result.results[1]).toMatchObject({ ok: false, error: phase1Error })
  })

  it("CLI step failure with no error field — falls back to default CLI error", () => {
    const requests = [makeRequest("issue.list")]
    const steps = [makeCliStep(0)]
    const failEnvelope: ResultEnvelope = {
      ok: false,
      meta: { capability_id: "issue.list", route_used: "cli" },
    }
    const cliResults = new Map([[0, failEnvelope]])

    const result = assembleResolutionFailure(requests, steps, phase1Error, cliResults)

    expect(result.results[0]).toMatchObject({
      ok: false,
      error: { code: errorCodes.Unknown, message: "CLI step failed", retryable: false },
    })
  })

  it("all CLI steps — route_used cli, status follows CLI outcomes", () => {
    const requests = [makeRequest("issue.list"), makeRequest("pr.list")]
    const steps = [makeCliStep(0), makeCliStep(1)]
    const cliResults = new Map([
      [0, makeSuccessEnvelope({ items: [] })],
      [1, makeSuccessEnvelope({ prs: [] })],
    ])

    const result = assembleResolutionFailure(requests, steps, phase1Error, cliResults)

    expect(result.meta.route_used).toBe("cli")
    expect(result.status).toBe("success")
  })

  it("mixed CLI + GQL steps — route_used graphql", () => {
    const requests = [makeRequest("issue.list"), makeRequest("repo.view")]
    const steps = [makeCliStep(0), makeGqlQueryStep(1)]
    const cliResults = new Map([[0, makeSuccessEnvelope({ items: [] })]])

    const result = assembleResolutionFailure(requests, steps, phase1Error, cliResults)

    expect(result.meta.route_used).toBe("graphql")
  })

  it("status partial when some CLI succeed and some GQL fail", () => {
    const requests = [makeRequest("issue.list"), makeRequest("repo.view"), makeRequest("pr.list")]
    const steps = [makeCliStep(0), makeGqlQueryStep(1), makeCliStep(2)]
    const cliResults = new Map([
      [0, makeSuccessEnvelope({ items: [] })],
      [2, makeSuccessEnvelope({ prs: [] })],
    ])

    const result = assembleResolutionFailure(requests, steps, phase1Error, cliResults)

    expect(result.status).toBe("partial")
    expect(result.meta.succeeded).toBe(2)
    expect(result.meta.failed).toBe(1)
    expect(result.meta.total).toBe(3)
  })

  it("meta fields are correct for full failure", () => {
    const requests = [makeRequest("repo.view"), makeRequest("issue.list")]
    const steps = [makeGqlQueryStep(0), makeGqlQueryStep(1)]

    const result = assembleResolutionFailure(requests, steps, phase1Error, new Map())

    expect(result.meta).toEqual({
      route_used: "graphql",
      total: 2,
      succeeded: 0,
      failed: 2,
    })
  })
})
