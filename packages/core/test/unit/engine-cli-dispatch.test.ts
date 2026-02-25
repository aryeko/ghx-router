import type { ResultEnvelope } from "@core/core/contracts/envelope.js"
import { errorCodes } from "@core/core/errors/codes.js"
import type { ClassifiedStep, ExecutionDeps } from "@core/core/routing/engine/types.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { baseCard, createGithubClient } from "../helpers/engine-fixtures.js"

const runSingleTaskMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  runSingleTaskMock.mockReset()
  vi.doMock("@core/core/routing/engine/single.js", () => ({
    runSingleTask: (...args: unknown[]) => runSingleTaskMock(...args),
  }))
})

function makeDeps(): ExecutionDeps {
  return { githubClient: createGithubClient() } as ExecutionDeps
}

function makeCliStep(index: number): ClassifiedStep {
  return {
    route: "cli",
    card: { ...baseCard, capability_id: `cap.${index}` },
    index,
    request: { task: `cap.${index}`, input: { owner: "acme" } },
  }
}

function makeGqlStep(index: number): ClassifiedStep {
  return {
    route: "gql-query",
    card: { ...baseCard, capability_id: `cap.${index}` },
    index,
    request: { task: `cap.${index}`, input: { owner: "acme" } },
  }
}

function makeRequest(index: number): { task: string; input: Record<string, unknown> } {
  return { task: `cap.${index}`, input: { owner: "acme" } }
}

function makeSuccessEnvelope(capabilityId: string): ResultEnvelope {
  return {
    ok: true,
    data: { result: "ok" },
    meta: { capability_id: capabilityId, route_used: "cli" },
  }
}

// ===========================================================================
// startCliSteps
// ===========================================================================

describe("startCliSteps", () => {
  it("filters out non-CLI steps and only maps CLI steps", async () => {
    const { startCliSteps } = await import("@core/core/routing/engine/cli-dispatch.js")

    const steps: ClassifiedStep[] = [makeGqlStep(0), makeCliStep(1), makeGqlStep(2)]
    const requests = [makeRequest(0), makeRequest(1), makeRequest(2)]
    const deps = makeDeps()

    runSingleTaskMock.mockResolvedValue(makeSuccessEnvelope("cap.1"))

    const promises = startCliSteps(steps, requests, deps)

    expect(promises).toHaveLength(1)
    const [p0] = promises
    if (p0 === undefined) throw new Error("expected promise")
    const [index, result] = await p0
    expect(index).toBe(1)
    expect(result.ok).toBe(true)
  })

  it("returns a promise per CLI step that resolves to [index, ResultEnvelope]", async () => {
    const { startCliSteps } = await import("@core/core/routing/engine/cli-dispatch.js")

    const steps: ClassifiedStep[] = [makeCliStep(0), makeCliStep(2)]
    const requests = [makeRequest(0), makeRequest(1), makeRequest(2)]
    const deps = makeDeps()

    runSingleTaskMock
      .mockResolvedValueOnce(makeSuccessEnvelope("cap.0"))
      .mockResolvedValueOnce(makeSuccessEnvelope("cap.2"))

    const promises = startCliSteps(steps, requests, deps)

    expect(promises).toHaveLength(2)

    const [p0, p1] = promises
    if (p0 === undefined || p1 === undefined) throw new Error("expected promises")
    const [idx0, result0] = await p0
    expect(idx0).toBe(0)
    expect(result0.ok).toBe(true)

    const [idx2, result2] = await p1
    expect(idx2).toBe(2)
    expect(result2.ok).toBe(true)
  })

  it("wraps a successful runSingleTask result into [index, result]", async () => {
    const { startCliSteps } = await import("@core/core/routing/engine/cli-dispatch.js")

    const steps: ClassifiedStep[] = [makeCliStep(3)]
    const requests = [makeRequest(0), makeRequest(1), makeRequest(2), makeRequest(3)]
    const deps = makeDeps()

    const envelope = makeSuccessEnvelope("cap.3")
    runSingleTaskMock.mockResolvedValue(envelope)

    const promises = startCliSteps(steps, requests, deps)
    const [p0] = promises
    if (p0 === undefined) throw new Error("expected promise")
    const [index, result] = await p0

    expect(index).toBe(3)
    expect(result).toEqual(envelope)
    expect(runSingleTaskMock).toHaveBeenCalledWith("cap.3", { owner: "acme" }, deps)
  })

  it("wraps a rejected runSingleTask into [index, error envelope] with errorCodes.Unknown", async () => {
    const { startCliSteps } = await import("@core/core/routing/engine/cli-dispatch.js")

    const steps: ClassifiedStep[] = [makeCliStep(1)]
    const requests = [makeRequest(0), makeRequest(1)]
    const deps = makeDeps()

    runSingleTaskMock.mockRejectedValue(new Error("gh command failed"))

    const promises = startCliSteps(steps, requests, deps)
    const [p0] = promises
    if (p0 === undefined) throw new Error("expected promise")
    const [index, result] = await p0

    expect(index).toBe(1)
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe(errorCodes.Unknown)
    expect(result.error?.message).toBe("gh command failed")
    expect(result.error?.retryable).toBe(false)
    expect(result.meta.capability_id).toBe("cap.1")
    expect(result.meta.route_used).toBe("cli")
  })

  it("handles non-Error rejection with string coercion", async () => {
    const { startCliSteps } = await import("@core/core/routing/engine/cli-dispatch.js")

    const steps: ClassifiedStep[] = [makeCliStep(0)]
    const requests = [makeRequest(0)]
    const deps = makeDeps()

    runSingleTaskMock.mockRejectedValue("unexpected string error")

    const promises = startCliSteps(steps, requests, deps)
    const [p0] = promises
    if (p0 === undefined) throw new Error("expected promise")
    const [index, result] = await p0

    expect(index).toBe(0)
    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe("unexpected string error")
  })

  it("returns immediate error envelope when request at step.index is undefined", async () => {
    const { startCliSteps } = await import("@core/core/routing/engine/cli-dispatch.js")

    // step.index = 5 but requests array only has indices 0-1
    const step: ClassifiedStep = {
      route: "cli",
      card: baseCard,
      index: 5,
      request: { task: baseCard.capability_id, input: {} },
    }
    const requests = [makeRequest(0), makeRequest(1)]
    const deps = makeDeps()

    const promises = startCliSteps([step], requests, deps)
    expect(promises).toHaveLength(1)

    const [p0] = promises
    if (p0 === undefined) throw new Error("expected promise")
    const [index, result] = await p0
    expect(index).toBe(5)
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe(errorCodes.Unknown)
    expect(result.error?.message).toBe("missing request")
    expect(result.meta.capability_id).toBe(baseCard.capability_id)
    expect(result.meta.route_used).toBe("cli")
    expect(runSingleTaskMock).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// collectCliResults
// ===========================================================================

describe("collectCliResults", () => {
  it("returns empty Map when given empty arrays", async () => {
    const { collectCliResults } = await import("@core/core/routing/engine/cli-dispatch.js")

    const result = await collectCliResults([], [], [])
    expect(result.size).toBe(0)
  })

  it("sets fulfilled outcome into Map keyed by cliStep.index", async () => {
    const { collectCliResults } = await import("@core/core/routing/engine/cli-dispatch.js")

    const step = makeCliStep(7)
    const envelope = makeSuccessEnvelope("cap.7")
    const promise = Promise.resolve<[number, ResultEnvelope]>([7, envelope])

    const result = await collectCliResults([promise], [step], [makeRequest(7)])

    expect(result.size).toBe(1)
    expect(result.get(7)).toEqual(envelope)
  })

  it("maps by cliStep.index, not by position j in the cliSteps array", async () => {
    const { collectCliResults } = await import("@core/core/routing/engine/cli-dispatch.js")

    // j=0 corresponds to step with index=4
    const step = makeCliStep(4)
    const envelope = makeSuccessEnvelope("cap.4")
    const promise = Promise.resolve<[number, ResultEnvelope]>([4, envelope])

    const requests = [
      makeRequest(0),
      makeRequest(1),
      makeRequest(2),
      makeRequest(3),
      makeRequest(4),
    ]

    const result = await collectCliResults([promise], [step], requests)

    expect(result.has(0)).toBe(false)
    expect(result.has(4)).toBe(true)
    expect(result.get(4)).toEqual(envelope)
  })

  it("sets error envelope when a promise is rejected", async () => {
    const { collectCliResults } = await import("@core/core/routing/engine/cli-dispatch.js")

    const step = makeCliStep(2)
    const rejected = Promise.reject<[number, ResultEnvelope]>(new Error("network failure"))
    const requests = [makeRequest(0), makeRequest(1), makeRequest(2)]

    const result = await collectCliResults([rejected], [step], requests)

    const entry = result.get(2)
    expect(entry).toBeDefined()
    expect(entry?.ok).toBe(false)
    expect(entry?.error?.code).toBe(errorCodes.Unknown)
    expect(entry?.error?.message).toBe("network failure")
    expect(entry?.error?.retryable).toBe(false)
    expect(entry?.meta.capability_id).toBe("cap.2")
    expect(entry?.meta.route_used).toBe("cli")
  })

  it("uses 'unknown' capability_id when request is missing on rejection", async () => {
    const { collectCliResults } = await import("@core/core/routing/engine/cli-dispatch.js")

    const step: ClassifiedStep = {
      route: "cli",
      card: baseCard,
      index: 99,
      request: { task: baseCard.capability_id, input: {} },
    }
    const rejected = Promise.reject<[number, ResultEnvelope]>(new Error("oops"))
    // requests array has no index 99
    const requests = [makeRequest(0)]

    const result = await collectCliResults([rejected], [step], requests)

    const entry = result.get(99)
    expect(entry?.meta.capability_id).toBe("unknown")
  })

  it("collects multiple CLI steps with mixed fulfilled and rejected outcomes", async () => {
    const { collectCliResults } = await import("@core/core/routing/engine/cli-dispatch.js")

    const step0 = makeCliStep(0)
    const step1 = makeCliStep(1)
    const step2 = makeCliStep(2)

    const envelope0 = makeSuccessEnvelope("cap.0")
    const envelope2 = makeSuccessEnvelope("cap.2")

    const promises: Array<Promise<[number, ResultEnvelope]>> = [
      Promise.resolve<[number, ResultEnvelope]>([0, envelope0]),
      Promise.reject<[number, ResultEnvelope]>(new Error("step 1 failed")),
      Promise.resolve<[number, ResultEnvelope]>([2, envelope2]),
    ]

    const requests = [makeRequest(0), makeRequest(1), makeRequest(2)]

    const result = await collectCliResults(promises, [step0, step1, step2], requests)

    expect(result.size).toBe(3)
    expect(result.get(0)).toEqual(envelope0)
    expect(result.get(1)?.ok).toBe(false)
    expect(result.get(1)?.error?.message).toBe("step 1 failed")
    expect(result.get(2)).toEqual(envelope2)
  })
})
