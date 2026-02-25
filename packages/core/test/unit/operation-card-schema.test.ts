import { operationCardSchema } from "@core/core/registry/operation-card-schema.js"
import { Ajv } from "ajv"
import { describe, expect, it } from "vitest"

const ajv = new Ajv()
const validate = ajv.compile(operationCardSchema)

describe("operationCardSchema resolution", () => {
  it("accepts a card with scalar resolution", () => {
    const card = {
      capability_id: "issue.milestone.set",
      version: "1.0.0",
      description: "Set milestone",
      input_schema: { type: "object" },
      output_schema: { type: "object" },
      routing: { preferred: "graphql", fallbacks: [] },
      graphql: {
        operationName: "IssueMilestoneSet",
        operationType: "mutation",
        documentPath: "src/gql/operations/issue-milestone-set.graphql",
        resolution: {
          lookup: {
            operationName: "IssueMilestoneLookup",
            documentPath: "src/gql/operations/issue-milestone-lookup.graphql",
            vars: { issueId: "issueId", milestoneNumber: "milestoneNumber" },
          },
          inject: [
            { target: "milestoneId", source: "scalar", path: "node.repository.milestone.id" },
          ],
        },
      },
    }
    expect(validate(card)).toBe(true)
  })

  it("accepts a card with map_array resolution", () => {
    const card = {
      capability_id: "issue.labels.update",
      version: "1.0.0",
      description: "Update labels",
      input_schema: { type: "object" },
      output_schema: { type: "object" },
      routing: { preferred: "graphql", fallbacks: [] },
      graphql: {
        operationName: "IssueLabelsUpdate",
        operationType: "mutation",
        documentPath: "src/gql/operations/issue-labels-update.graphql",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "src/gql/operations/issue-labels-lookup.graphql",
            vars: { issueId: "issueId" },
          },
          inject: [
            {
              target: "labelIds",
              source: "map_array",
              from_input: "labels",
              nodes_path: "node.repository.labels.nodes",
              match_field: "name",
              extract_field: "id",
            },
          ],
        },
      },
    }
    expect(validate(card)).toBe(true)
  })

  it("rejects resolution with unknown source", () => {
    const card = {
      capability_id: "x",
      version: "1.0.0",
      description: "x",
      input_schema: { type: "object" },
      output_schema: { type: "object" },
      routing: { preferred: "graphql", fallbacks: [] },
      graphql: {
        operationName: "X",
        documentPath: "x.graphql",
        resolution: {
          lookup: { operationName: "Y", documentPath: "y.graphql", vars: {} },
          inject: [{ target: "t", source: "unknown_source", path: "a.b" }],
        },
      },
    }
    expect(validate(card)).toBe(false)
  })
})
