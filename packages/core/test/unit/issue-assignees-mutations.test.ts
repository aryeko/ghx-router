import { describe, expect, it, vi } from "vitest"
import {
  runIssueAssigneesAdd,
  runIssueAssigneesRemove,
} from "../../src/gql/domains/issue-mutations.js"
import type { GraphqlTransport } from "../../src/gql/transport.js"

function makeLookupResponse(
  issueId: string,
  assignableUsers: Array<{ id: string; login: string }>,
) {
  return {
    repository: {
      issue: { id: issueId },
      assignableUsers: { nodes: assignableUsers },
    },
  }
}

function makeMutationResponse(mutationKey: string, issueId: string, assigneeLogins: string[]) {
  return {
    [mutationKey]: {
      assignable: {
        id: issueId,
        assignees: {
          nodes: assigneeLogins.map((login) => ({ login })),
        },
      },
    },
  }
}

const baseInput = {
  owner: "acme",
  name: "repo",
  issueNumber: 42,
}

describe("runIssueAssigneesAdd", () => {
  it("validates input — rejects empty owner", async () => {
    const transport: GraphqlTransport = { execute: vi.fn() }
    await expect(
      runIssueAssigneesAdd(transport, { ...baseInput, owner: "", assignees: ["alice"] }),
    ).rejects.toThrow("Repository owner and name are required")
  })

  it("validates input — rejects assignees with empty strings", async () => {
    const transport: GraphqlTransport = { execute: vi.fn() }
    await expect(
      runIssueAssigneesAdd(transport, { ...baseInput, assignees: [""] }),
    ).rejects.toThrow("Assignees must be an array of non-empty strings")
  })

  it("validates input — rejects invalid issue number", async () => {
    const transport: GraphqlTransport = { execute: vi.fn() }
    await expect(
      runIssueAssigneesAdd(transport, { ...baseInput, issueNumber: 0, assignees: ["alice"] }),
    ).rejects.toThrow("Issue number must be a positive integer")
  })

  it("throws when issue not found in lookup", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: { issue: null, assignableUsers: { nodes: [] } },
    })
    const transport: GraphqlTransport = { execute }

    await expect(
      runIssueAssigneesAdd(transport, { ...baseInput, assignees: ["alice"] }),
    ).rejects.toThrow("Issue not found")
  })

  it("throws when assignee login not found in assignable users", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(makeLookupResponse("I_1", [{ id: "U_1", login: "bob" }]))
    const transport: GraphqlTransport = { execute }

    await expect(
      runIssueAssigneesAdd(transport, { ...baseInput, assignees: ["charlie"] }),
    ).rejects.toThrow("Assignee not found: charlie")
  })

  it("adds assignees and returns result", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(
        makeLookupResponse("I_1", [
          { id: "U_1", login: "alice" },
          { id: "U_2", login: "bob" },
        ]),
      )
      .mockResolvedValueOnce(
        makeMutationResponse("addAssigneesToAssignable", "I_1", ["alice", "bob"]),
      )
    const transport: GraphqlTransport = { execute }

    const result = await runIssueAssigneesAdd(transport, {
      ...baseInput,
      assignees: ["alice", "bob"],
    })

    expect(result).toEqual({ id: "I_1", assignees: ["alice", "bob"] })
    expect(execute).toHaveBeenCalledTimes(2)

    const mutVars = execute.mock.calls[1]?.[1] as Record<string, unknown>
    expect(mutVars).toMatchObject({
      assignableId: "I_1",
      assigneeIds: ["U_1", "U_2"],
    })
  })

  it("matches assignee logins case-insensitively", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(makeLookupResponse("I_1", [{ id: "U_1", login: "Alice" }]))
      .mockResolvedValueOnce(makeMutationResponse("addAssigneesToAssignable", "I_1", ["Alice"]))
    const transport: GraphqlTransport = { execute }

    const result = await runIssueAssigneesAdd(transport, {
      ...baseInput,
      assignees: ["alice"],
    })
    expect(result).toEqual({ id: "I_1", assignees: ["Alice"] })
  })
})

describe("runIssueAssigneesRemove", () => {
  it("validates input — rejects empty owner", async () => {
    const transport: GraphqlTransport = { execute: vi.fn() }
    await expect(
      runIssueAssigneesRemove(transport, { ...baseInput, owner: "", assignees: ["alice"] }),
    ).rejects.toThrow("Repository owner and name are required")
  })

  it("throws when issue not found in lookup", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: { issue: null, assignableUsers: { nodes: [] } },
    })
    const transport: GraphqlTransport = { execute }

    await expect(
      runIssueAssigneesRemove(transport, { ...baseInput, assignees: ["alice"] }),
    ).rejects.toThrow("Issue not found")
  })

  it("removes assignees and returns result", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(
        makeLookupResponse("I_1", [
          { id: "U_1", login: "alice" },
          { id: "U_2", login: "bob" },
        ]),
      )
      .mockResolvedValueOnce(makeMutationResponse("removeAssigneesFromAssignable", "I_1", ["bob"]))
    const transport: GraphqlTransport = { execute }

    const result = await runIssueAssigneesRemove(transport, {
      ...baseInput,
      assignees: ["alice"],
    })

    expect(result).toEqual({ id: "I_1", assignees: ["bob"] })
    expect(execute).toHaveBeenCalledTimes(2)

    const mutVars = execute.mock.calls[1]?.[1] as Record<string, unknown>
    expect(mutVars).toMatchObject({
      assignableId: "I_1",
      assigneeIds: ["U_1"],
    })
  })
})
