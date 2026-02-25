import { describe, expect, it, vi } from "vitest"
import {
  runProjectV2ItemAdd,
  runProjectV2ItemFieldUpdate,
  runProjectV2ItemRemove,
} from "../../../../src/gql/domains/project.js"
import type { GraphqlTransport } from "../../../../src/gql/transport.js"

// --- runProjectV2ItemAdd ---

describe("runProjectV2ItemAdd", () => {
  const addInput = {
    owner: "my-org",
    projectNumber: 1,
    issueUrl: "https://github.com/my-org/my-repo/issues/42",
  }

  it("throws when owner is empty", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemAdd(transport, { ...addInput, owner: "" })).rejects.toThrow(
      "Project owner is required",
    )
  })

  it("throws when projectNumber is not a positive integer", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemAdd(transport, { ...addInput, projectNumber: 0 })).rejects.toThrow(
      "Project number must be a positive integer",
    )
  })

  it("throws when issueUrl is empty", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemAdd(transport, { ...addInput, issueUrl: "" })).rejects.toThrow(
      "issueUrl is required",
    )
  })

  it("throws when project not found for owner", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ organization: null })
      .mockResolvedValueOnce({ user: null })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemAdd(transport, addInput)).rejects.toThrow(
      `Project #1 not found for owner "my-org"`,
    )
  })

  it("throws when issue not found at URL", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ organization: { projectV2: { id: "PVT_kwDOA_proj1" } } })
      .mockResolvedValueOnce({ resource: null })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemAdd(transport, addInput)).rejects.toThrow(
      `Issue not found at URL "${addInput.issueUrl}"`,
    )
  })

  it("throws when addProjectV2ItemById returns no item", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ organization: { projectV2: { id: "PVT_kwDOA_proj1" } } })
      .mockResolvedValueOnce({ resource: { __typename: "Issue", id: "I_kwDOA_issue1" } })
      .mockResolvedValueOnce({ addProjectV2ItemById: { item: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemAdd(transport, addInput)).rejects.toThrow(
      "Failed to add item to project",
    )
  })

  it("returns mapped data on success via org lookup", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ organization: { projectV2: { id: "PVT_kwDOA_proj1" } } })
      .mockResolvedValueOnce({ resource: { __typename: "Issue", id: "I_kwDOA_issue1" } })
      .mockResolvedValueOnce({
        addProjectV2ItemById: {
          item: { id: "PVTI_kwDOA_item1", type: "ISSUE" },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemAdd(transport, addInput)

    expect(result.itemId).toBe("PVTI_kwDOA_item1")
    expect(result.itemType).toBe("ISSUE")
  })

  it("falls back to user lookup when org lookup finds no project", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ organization: null })
      .mockResolvedValueOnce({ user: { projectV2: { id: "PVT_kwDOA_userproj1" } } })
      .mockResolvedValueOnce({ resource: { __typename: "Issue", id: "I_kwDOA_issue1" } })
      .mockResolvedValueOnce({
        addProjectV2ItemById: {
          item: { id: "PVTI_kwDOA_item1", type: "ISSUE" },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemAdd(transport, addInput)

    expect(result.itemId).toBe("PVTI_kwDOA_item1")
  })

  it("returns itemType as null when type is null", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ organization: { projectV2: { id: "PVT_kwDOA_proj1" } } })
      .mockResolvedValueOnce({ resource: { __typename: "Issue", id: "I_kwDOA_issue1" } })
      .mockResolvedValueOnce({
        addProjectV2ItemById: {
          item: { id: "PVTI_kwDOA_item1", type: null },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemAdd(transport, addInput)

    expect(result.itemType).toBeNull()
  })
})

// --- runProjectV2ItemRemove ---

describe("runProjectV2ItemRemove", () => {
  const removeInput = {
    owner: "my-org",
    projectNumber: 1,
    itemId: "PVTI_kwDOA_item1",
  }

  it("throws when owner is empty", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemRemove(transport, { ...removeInput, owner: "" })).rejects.toThrow(
      "Project owner is required",
    )
  })

  it("throws when projectNumber is not a positive integer", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runProjectV2ItemRemove(transport, { ...removeInput, projectNumber: 0 }),
    ).rejects.toThrow("Project number must be a positive integer")
  })

  it("throws when itemId is empty", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemRemove(transport, { ...removeInput, itemId: "" })).rejects.toThrow(
      "itemId is required",
    )
  })

  it("throws when project not found for owner", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ organization: null })
      .mockResolvedValueOnce({ user: null })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemRemove(transport, removeInput)).rejects.toThrow(
      `Project #1 not found for owner "my-org"`,
    )
  })

  it("throws when deleteProjectV2Item returns no deletedItemId", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ organization: { projectV2: { id: "PVT_kwDOA_proj1" } } })
      .mockResolvedValueOnce({ deleteProjectV2Item: { deletedItemId: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemRemove(transport, removeInput)).rejects.toThrow(
      "Failed to remove item from project",
    )
  })

  it("returns deletedItemId on success", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ organization: { projectV2: { id: "PVT_kwDOA_proj1" } } })
      .mockResolvedValueOnce({ deleteProjectV2Item: { deletedItemId: "PVTI_kwDOA_item1" } })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemRemove(transport, removeInput)

    expect(result.deletedItemId).toBe("PVTI_kwDOA_item1")
  })

  it("falls back to user lookup when org lookup finds no project", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ organization: null })
      .mockResolvedValueOnce({ user: { projectV2: { id: "PVT_kwDOA_userproj1" } } })
      .mockResolvedValueOnce({ deleteProjectV2Item: { deletedItemId: "PVTI_kwDOA_item1" } })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemRemove(transport, removeInput)

    expect(result.deletedItemId).toBe("PVTI_kwDOA_item1")
  })
})

// --- runProjectV2ItemFieldUpdate ---

describe("runProjectV2ItemFieldUpdate", () => {
  const fieldUpdateInput = {
    projectId: "PVT_kwDOA_proj1",
    itemId: "PVTI_kwDOA_item1",
    fieldId: "PVTF_kwDOA_field1",
    valueSingleSelectOptionId: "opt-done",
  }

  it("throws when projectId is empty", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runProjectV2ItemFieldUpdate(transport, { ...fieldUpdateInput, projectId: "" }),
    ).rejects.toThrow("projectId is required")
  })

  it("throws when itemId is empty", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runProjectV2ItemFieldUpdate(transport, { ...fieldUpdateInput, itemId: "" }),
    ).rejects.toThrow("itemId is required")
  })

  it("throws when fieldId is empty", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runProjectV2ItemFieldUpdate(transport, { ...fieldUpdateInput, fieldId: "" }),
    ).rejects.toThrow("fieldId is required")
  })

  it("throws when no value field is provided", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }
    const inputWithNoValue = {
      projectId: "PVT_kwDOA_proj1",
      itemId: "PVTI_kwDOA_item1",
      fieldId: "PVTF_kwDOA_field1",
    }

    await expect(runProjectV2ItemFieldUpdate(transport, inputWithNoValue)).rejects.toThrow(
      "At least one value field must be provided",
    )
  })

  it("throws when updateProjectV2ItemFieldValue returns no item", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ updateProjectV2ItemFieldValue: { projectV2Item: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemFieldUpdate(transport, fieldUpdateInput)).rejects.toThrow(
      "Failed to update project item field",
    )
  })

  it("throws when updateProjectV2ItemFieldValue is null", async () => {
    const execute = vi.fn().mockResolvedValue({ updateProjectV2ItemFieldValue: null })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemFieldUpdate(transport, fieldUpdateInput)).rejects.toThrow(
      "Failed to update project item field",
    )
  })

  it("returns itemId on success with singleSelectOptionId", async () => {
    const execute = vi.fn().mockResolvedValue({
      updateProjectV2ItemFieldValue: {
        projectV2Item: { id: "PVTI_kwDOA_item1" },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemFieldUpdate(transport, fieldUpdateInput)

    expect(result.itemId).toBe("PVTI_kwDOA_item1")
  })

  it("builds correct value from valueText", async () => {
    const execute = vi.fn().mockResolvedValue({
      updateProjectV2ItemFieldValue: {
        projectV2Item: { id: "PVTI_kwDOA_item1" },
      },
    })
    const transport: GraphqlTransport = { execute }

    await runProjectV2ItemFieldUpdate(transport, {
      projectId: "PVT_kwDOA_proj1",
      itemId: "PVTI_kwDOA_item1",
      fieldId: "PVTF_kwDOA_field1",
      valueText: "hello",
    })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[0]!
    expect(vars).toMatchObject({ value: { text: "hello" } })
  })

  it("builds correct value from valueNumber", async () => {
    const execute = vi.fn().mockResolvedValue({
      updateProjectV2ItemFieldValue: {
        projectV2Item: { id: "PVTI_kwDOA_item1" },
      },
    })
    const transport: GraphqlTransport = { execute }

    await runProjectV2ItemFieldUpdate(transport, {
      projectId: "PVT_kwDOA_proj1",
      itemId: "PVTI_kwDOA_item1",
      fieldId: "PVTF_kwDOA_field1",
      valueNumber: 42,
    })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[0]!
    expect(vars).toMatchObject({ value: { number: 42 } })
  })

  it("builds correct value from valueDate", async () => {
    const execute = vi.fn().mockResolvedValue({
      updateProjectV2ItemFieldValue: {
        projectV2Item: { id: "PVTI_kwDOA_item1" },
      },
    })
    const transport: GraphqlTransport = { execute }

    await runProjectV2ItemFieldUpdate(transport, {
      projectId: "PVT_kwDOA_proj1",
      itemId: "PVTI_kwDOA_item1",
      fieldId: "PVTF_kwDOA_field1",
      valueDate: "2024-01-01",
    })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[0]!
    expect(vars).toMatchObject({ value: { date: "2024-01-01" } })
  })

  it("builds correct value from valueIterationId", async () => {
    const execute = vi.fn().mockResolvedValue({
      updateProjectV2ItemFieldValue: {
        projectV2Item: { id: "PVTI_kwDOA_item1" },
      },
    })
    const transport: GraphqlTransport = { execute }

    await runProjectV2ItemFieldUpdate(transport, {
      projectId: "PVT_kwDOA_proj1",
      itemId: "PVTI_kwDOA_item1",
      fieldId: "PVTF_kwDOA_field1",
      valueIterationId: "iter-abc",
    })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[0]!
    expect(vars).toMatchObject({ value: { iterationId: "iter-abc" } })
  })

  it("builds empty value when clear is true", async () => {
    const execute = vi.fn().mockResolvedValue({
      updateProjectV2ItemFieldValue: {
        projectV2Item: { id: "PVTI_kwDOA_item1" },
      },
    })
    const transport: GraphqlTransport = { execute }

    await runProjectV2ItemFieldUpdate(transport, {
      projectId: "PVT_kwDOA_proj1",
      itemId: "PVTI_kwDOA_item1",
      fieldId: "PVTF_kwDOA_field1",
      clear: true,
    })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[0]!
    expect(vars).toMatchObject({ value: {} })
  })

  it("passes correct base variables to execute", async () => {
    const execute = vi.fn().mockResolvedValue({
      updateProjectV2ItemFieldValue: {
        projectV2Item: { id: "PVTI_kwDOA_item1" },
      },
    })
    const transport: GraphqlTransport = { execute }

    await runProjectV2ItemFieldUpdate(transport, fieldUpdateInput)

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[0]!
    expect(vars).toMatchObject({
      projectId: "PVT_kwDOA_proj1",
      itemId: "PVTI_kwDOA_item1",
      fieldId: "PVTF_kwDOA_field1",
      value: { singleSelectOptionId: "opt-done" },
    })
  })
})
