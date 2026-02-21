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

  it("input: passes value from input field directly", () => {
    const spec: InjectSpec = {
      target: "labelableId",
      source: "input",
      from_input: "issueId",
    }
    const input = { issueId: "I_123" }
    expect(applyInject(spec, {}, input)).toEqual({ labelableId: "I_123" })
  })

  it("input: throws when input field is missing", () => {
    const spec: InjectSpec = {
      target: "labelableId",
      source: "input",
      from_input: "issueId",
    }
    expect(() => applyInject(spec, {}, {})).toThrow("labelableId")
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

  it("map_array throws when pageInfo.hasNextPage is true", () => {
    const nodes = Array.from({ length: 100 }, (_, i) => ({
      id: `U_${i}`,
      login: `user${i}`,
    }))
    const lookupResult = {
      repository: {
        assignableUsers: {
          pageInfo: { hasNextPage: true },
          nodes,
        },
      },
    }
    const spec: InjectSpec = {
      target: "assigneeIds",
      source: "map_array",
      from_input: "assignees",
      nodes_path: "repository.assignableUsers.nodes",
      match_field: "login",
      extract_field: "id",
    }
    const input = { assignees: ["user1"] }
    expect(() => applyInject(spec, lookupResult, input)).toThrow(
      "lookup returned 100 items but more exist",
    )
  })

  it("map_array succeeds when pageInfo.hasNextPage is false", () => {
    const lookupResult = {
      repository: {
        assignableUsers: {
          pageInfo: { hasNextPage: false },
          nodes: [{ login: "user1", id: "U_abc" }],
        },
      },
    }
    const spec: InjectSpec = {
      target: "assigneeIds",
      source: "map_array",
      from_input: "assignees",
      nodes_path: "repository.assignableUsers.nodes",
      match_field: "login",
      extract_field: "id",
    }
    const input = { assignees: ["user1"] }
    expect(applyInject(spec, lookupResult, input)).toEqual({ assigneeIds: ["U_abc"] })
  })

  it("null_literal: returns target set to null", () => {
    const spec: InjectSpec = {
      target: "milestoneId",
      source: "null_literal",
    }
    expect(applyInject(spec, {}, {})).toEqual({ milestoneId: null })
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
