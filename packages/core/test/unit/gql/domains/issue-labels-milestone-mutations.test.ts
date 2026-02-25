import { describe, expect, it, vi } from "vitest"
import {
  runIssueLabelsRemove,
  runIssueMilestoneClear,
} from "../../../../src/gql/domains/issue-mutations.js"
import type { GraphqlTransport } from "../../../../src/gql/transport.js"

const baseInput = {
  owner: "acme",
  name: "repo",
  issueNumber: 42,
}

function makeLookupResponse(issueId: string, labelNodes: Array<{ id: string; name: string }>) {
  return {
    repository: {
      issue: { id: issueId },
      labels: { nodes: labelNodes },
    },
  }
}

// --- runIssueLabelsRemove ---

describe("runIssueLabelsRemove", () => {
  it("validates input — rejects empty owner", async () => {
    const transport: GraphqlTransport = { execute: vi.fn() }
    await expect(
      runIssueLabelsRemove(transport, { ...baseInput, owner: "", labels: ["bug"] }),
    ).rejects.toThrow("Repository owner and name are required")
  })

  it("validates input — rejects invalid issue number", async () => {
    const transport: GraphqlTransport = { execute: vi.fn() }
    await expect(
      runIssueLabelsRemove(transport, { ...baseInput, issueNumber: 0, labels: ["bug"] }),
    ).rejects.toThrow("Issue number must be a positive integer")
  })

  it("validates input — rejects empty labels array", async () => {
    const transport: GraphqlTransport = { execute: vi.fn() }
    await expect(runIssueLabelsRemove(transport, { ...baseInput, labels: [] })).rejects.toThrow(
      "Labels must not be empty",
    )
  })

  it("validates input — rejects labels with empty string", async () => {
    const transport: GraphqlTransport = { execute: vi.fn() }
    await expect(runIssueLabelsRemove(transport, { ...baseInput, labels: [""] })).rejects.toThrow(
      "Labels must be an array of non-empty strings",
    )
  })

  it("throws when issue not found in lookup", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: { issue: null, labels: { nodes: [] } },
    })
    const transport: GraphqlTransport = { execute }

    await expect(
      runIssueLabelsRemove(transport, { ...baseInput, labels: ["bug"] }),
    ).rejects.toThrow("Issue not found")
  })

  it("throws when label not found in repo labels", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(makeLookupResponse("I_1", [{ id: "L_1", name: "enhancement" }]))
    const transport: GraphqlTransport = { execute }

    await expect(
      runIssueLabelsRemove(transport, { ...baseInput, labels: ["bug"] }),
    ).rejects.toThrow("Label not found: bug")
  })

  it("removes labels and returns issueNumber + removed", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(
        makeLookupResponse("I_1", [
          { id: "L_1", name: "bug" },
          { id: "L_2", name: "enhancement" },
        ]),
      )
      .mockResolvedValueOnce({ removeLabelsFromLabelable: { labelable: { id: "I_1" } } })
    const transport: GraphqlTransport = { execute }

    const result = await runIssueLabelsRemove(transport, { ...baseInput, labels: ["bug"] })

    expect(result).toEqual({ issueNumber: 42, removed: ["bug"] })
    expect(execute).toHaveBeenCalledTimes(2)

    const mutVars = execute.mock.calls[1]?.[1] as Record<string, unknown>
    expect(mutVars).toMatchObject({ labelableId: "I_1", labelIds: ["L_1"] })
  })

  it("matches label names case-insensitively", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(makeLookupResponse("I_1", [{ id: "L_1", name: "Bug" }]))
      .mockResolvedValueOnce({ removeLabelsFromLabelable: { labelable: { id: "I_1" } } })
    const transport: GraphqlTransport = { execute }

    const result = await runIssueLabelsRemove(transport, { ...baseInput, labels: ["bug"] })

    expect(result).toEqual({ issueNumber: 42, removed: ["bug"] })
    const mutVars = execute.mock.calls[1]?.[1] as Record<string, unknown>
    expect(mutVars).toMatchObject({ labelIds: ["L_1"] })
  })

  it("removes multiple labels in one call", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(
        makeLookupResponse("I_1", [
          { id: "L_1", name: "bug" },
          { id: "L_2", name: "wontfix" },
        ]),
      )
      .mockResolvedValueOnce({ removeLabelsFromLabelable: { labelable: { id: "I_1" } } })
    const transport: GraphqlTransport = { execute }

    const result = await runIssueLabelsRemove(transport, {
      ...baseInput,
      labels: ["bug", "wontfix"],
    })

    expect(result).toEqual({ issueNumber: 42, removed: ["bug", "wontfix"] })
    const mutVars = execute.mock.calls[1]?.[1] as Record<string, unknown>
    expect(mutVars).toMatchObject({ labelIds: ["L_1", "L_2"] })
  })
})

// --- runIssueMilestoneClear ---

describe("runIssueMilestoneClear", () => {
  it("validates input — rejects empty owner", async () => {
    const transport: GraphqlTransport = { execute: vi.fn() }
    await expect(runIssueMilestoneClear(transport, { ...baseInput, owner: "" })).rejects.toThrow(
      "Repository owner and name are required",
    )
  })

  it("validates input — rejects invalid issue number", async () => {
    const transport: GraphqlTransport = { execute: vi.fn() }
    await expect(
      runIssueMilestoneClear(transport, { ...baseInput, issueNumber: 0 }),
    ).rejects.toThrow("Issue number must be a positive integer")
  })

  it("throws when issue not found in lookup", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: { issue: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runIssueMilestoneClear(transport, baseInput)).rejects.toThrow("Issue not found")
  })

  it("calls IssueMilestoneSet with milestoneId null and returns cleared result", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { issue: { id: "I_1" } } })
      .mockResolvedValueOnce({ updateIssue: { issue: { id: "I_1", milestone: null } } })
    const transport: GraphqlTransport = { execute }

    const result = await runIssueMilestoneClear(transport, baseInput)

    expect(result).toEqual({ issueNumber: 42, cleared: true })
    expect(execute).toHaveBeenCalledTimes(2)

    const mutVars = execute.mock.calls[1]?.[1] as Record<string, unknown>
    expect(mutVars).toMatchObject({ issueId: "I_1", milestoneId: null })
  })

  it("returns cleared:true regardless of mutation response shape", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { issue: { id: "I_42" } } })
      .mockResolvedValueOnce({ updateIssue: null })
    const transport: GraphqlTransport = { execute }

    const result = await runIssueMilestoneClear(transport, { ...baseInput, issueNumber: 99 })

    expect(result).toEqual({ issueNumber: 99, cleared: true })
  })
})
