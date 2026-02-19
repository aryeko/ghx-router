import type { InjectSpec } from "@core/core/registry/types.js"
import { applyInject, buildMutationVars } from "@core/gql/resolve.js"
import { describe, expect, it } from "vitest"

describe("applyInject", () => {
  it("scalar: extracts value at dot-path", () => {
    const lookupResult = { node: { repository: { milestone: { id: "M_456" } } } }
    const spec: InjectSpec = {
      target: "milestoneId",
      source: "scalar",
      path: "node.repository.milestone.id",
    }
    expect(applyInject(spec, lookupResult, {})).toEqual({ milestoneId: "M_456" })
  })

  it("scalar: throws when path not found", () => {
    const spec: InjectSpec = {
      target: "milestoneId",
      source: "scalar",
      path: "node.repository.milestone.id",
    }
    expect(() => applyInject(spec, {}, {})).toThrow("milestoneId")
  })

  it("map_array: maps names to ids", () => {
    const lookupResult = {
      node: {
        repository: {
          labels: {
            nodes: [
              { id: "L_1", name: "bug" },
              { id: "L_2", name: "feat" },
            ],
          },
        },
      },
    }
    const spec: InjectSpec = {
      target: "labelIds",
      source: "map_array",
      from_input: "labels",
      nodes_path: "node.repository.labels.nodes",
      match_field: "name",
      extract_field: "id",
    }
    const input = { labels: ["feat", "bug"] }
    expect(applyInject(spec, lookupResult, input)).toEqual({ labelIds: ["L_2", "L_1"] })
  })

  it("map_array: throws when name not found", () => {
    const lookupResult = { node: { repository: { labels: { nodes: [] } } } }
    const spec: InjectSpec = {
      target: "labelIds",
      source: "map_array",
      from_input: "labels",
      nodes_path: "node.repository.labels.nodes",
      match_field: "name",
      extract_field: "id",
    }
    const input = { labels: ["nonexistent"] }
    expect(() => applyInject(spec, lookupResult, input)).toThrow("nonexistent")
  })
})

describe("buildMutationVars", () => {
  it("passes through vars matching mutation variable names", () => {
    const mutDoc = `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`
    const input = { issueId: "I_123", extraField: "ignored" }
    const resolved: Record<string, unknown> = {}
    const vars = buildMutationVars(mutDoc, input, resolved)
    expect(vars).toEqual({ issueId: "I_123" })
  })

  it("resolved vars override pass-through", () => {
    const mutDoc = `mutation IssueLabelsUpdate($issueId: ID!, $labelIds: [ID!]!) { updateIssue(input: {id: $issueId, labelIds: $labelIds}) { issue { id } } }`
    const input = { issueId: "I_123", labels: ["bug"] }
    const resolved = { labelIds: ["L_1"] }
    const vars = buildMutationVars(mutDoc, input, resolved)
    expect(vars).toEqual({ issueId: "I_123", labelIds: ["L_1"] })
  })
})
