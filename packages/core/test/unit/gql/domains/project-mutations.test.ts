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
    projectId: "PVT_kwDOA_proj1",
    contentId: "I_kwDOA_issue1",
  }

  it("throws when projectId is empty", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemAdd(transport, { ...addInput, projectId: "" })).rejects.toThrow(
      "projectId is required",
    )
  })

  it("throws when contentId is empty", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemAdd(transport, { ...addInput, contentId: "" })).rejects.toThrow(
      "contentId is required",
    )
  })

  it("throws when addProjectV2ItemById returns no item", async () => {
    const execute = vi.fn().mockResolvedValue({ addProjectV2ItemById: { item: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemAdd(transport, addInput)).rejects.toThrow(
      "Failed to add item to project",
    )
  })

  it("throws when addProjectV2ItemById is null", async () => {
    const execute = vi.fn().mockResolvedValue({ addProjectV2ItemById: null })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemAdd(transport, addInput)).rejects.toThrow(
      "Failed to add item to project",
    )
  })

  it("returns mapped data on success", async () => {
    const execute = vi.fn().mockResolvedValue({
      addProjectV2ItemById: {
        item: {
          id: "PVTI_kwDOA_item1",
          type: "ISSUE",
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemAdd(transport, addInput)

    expect(result.itemId).toBe("PVTI_kwDOA_item1")
    expect(result.itemType).toBe("ISSUE")
  })

  it("returns itemType as null when type is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      addProjectV2ItemById: {
        item: {
          id: "PVTI_kwDOA_item1",
          type: null,
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemAdd(transport, addInput)

    expect(result.itemType).toBeNull()
  })

  it("passes correct variables to execute", async () => {
    const execute = vi.fn().mockResolvedValue({
      addProjectV2ItemById: {
        item: { id: "PVTI_kwDOA_item1", type: "ISSUE" },
      },
    })
    const transport: GraphqlTransport = { execute }

    await runProjectV2ItemAdd(transport, addInput)

    expect(execute).toHaveBeenCalledOnce()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[0]!
    expect(vars).toMatchObject({
      projectId: "PVT_kwDOA_proj1",
      contentId: "I_kwDOA_issue1",
    })
  })
})

// --- runProjectV2ItemRemove ---

describe("runProjectV2ItemRemove", () => {
  const removeInput = {
    projectId: "PVT_kwDOA_proj1",
    itemId: "PVTI_kwDOA_item1",
  }

  it("throws when projectId is empty", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runProjectV2ItemRemove(transport, { ...removeInput, projectId: "" }),
    ).rejects.toThrow("projectId is required")
  })

  it("throws when itemId is empty", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemRemove(transport, { ...removeInput, itemId: "" })).rejects.toThrow(
      "itemId is required",
    )
  })

  it("throws when deleteProjectV2Item returns no deletedItemId", async () => {
    const execute = vi.fn().mockResolvedValue({
      deleteProjectV2Item: { deletedItemId: null },
    })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemRemove(transport, removeInput)).rejects.toThrow(
      "Failed to remove item from project",
    )
  })

  it("throws when deleteProjectV2Item is null", async () => {
    const execute = vi.fn().mockResolvedValue({ deleteProjectV2Item: null })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemRemove(transport, removeInput)).rejects.toThrow(
      "Failed to remove item from project",
    )
  })

  it("returns deletedItemId on success", async () => {
    const execute = vi.fn().mockResolvedValue({
      deleteProjectV2Item: {
        deletedItemId: "PVTI_kwDOA_item1",
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemRemove(transport, removeInput)

    expect(result.deletedItemId).toBe("PVTI_kwDOA_item1")
  })

  it("passes correct variables to execute", async () => {
    const execute = vi.fn().mockResolvedValue({
      deleteProjectV2Item: { deletedItemId: "PVTI_kwDOA_item1" },
    })
    const transport: GraphqlTransport = { execute }

    await runProjectV2ItemRemove(transport, removeInput)

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[0]!
    expect(vars).toMatchObject({
      projectId: "PVT_kwDOA_proj1",
      itemId: "PVTI_kwDOA_item1",
    })
  })
})

// --- runProjectV2ItemFieldUpdate ---

describe("runProjectV2ItemFieldUpdate", () => {
  const fieldUpdateInput = {
    projectId: "PVT_kwDOA_proj1",
    itemId: "PVTI_kwDOA_item1",
    fieldId: "PVTF_kwDOA_field1",
    value: { singleSelectOptionId: "opt-done" },
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

  it("throws when updateProjectV2ItemFieldValue returns no item", async () => {
    const execute = vi.fn().mockResolvedValue({
      updateProjectV2ItemFieldValue: { projectV2Item: null },
    })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemFieldUpdate(transport, fieldUpdateInput)).rejects.toThrow(
      "Failed to update project item field",
    )
  })

  it("throws when updateProjectV2ItemFieldValue is null", async () => {
    const execute = vi.fn().mockResolvedValue({
      updateProjectV2ItemFieldValue: null,
    })
    const transport: GraphqlTransport = { execute }

    await expect(runProjectV2ItemFieldUpdate(transport, fieldUpdateInput)).rejects.toThrow(
      "Failed to update project item field",
    )
  })

  it("returns itemId on success", async () => {
    const execute = vi.fn().mockResolvedValue({
      updateProjectV2ItemFieldValue: {
        projectV2Item: {
          id: "PVTI_kwDOA_item1",
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runProjectV2ItemFieldUpdate(transport, fieldUpdateInput)

    expect(result.itemId).toBe("PVTI_kwDOA_item1")
  })

  it("passes correct variables to execute including value", async () => {
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
