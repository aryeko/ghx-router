export const operationCardSchema = {
  $id: "https://ghx.local/schemas/operation-card.json",
  type: "object",
  required: ["capability_id", "version", "description", "input_schema", "output_schema", "routing"],
  properties: {
    capability_id: { type: "string", minLength: 1 },
    version: { type: "string", minLength: 1 },
    description: { type: "string", minLength: 1 },
    input_schema: { type: "object" },
    output_schema: { type: "object" },
    routing: {
      type: "object",
      required: ["preferred", "fallbacks"],
      properties: {
        preferred: { enum: ["cli", "graphql", "rest"] },
        fallbacks: {
          type: "array",
          items: { enum: ["cli", "graphql", "rest"] },
        },
        suitability: {
          type: "array",
          items: {
            type: "object",
            required: ["when", "predicate", "reason"],
            properties: {
              when: { enum: ["always", "env", "params"] },
              predicate: { type: "string", minLength: 1 },
              reason: { type: "string", minLength: 1 },
            },
            additionalProperties: false,
          },
        },
        notes: {
          type: "array",
          items: { type: "string" },
        },
      },
      additionalProperties: false,
    },
    graphql: {
      type: "object",
      required: ["operationName", "documentPath"],
      properties: {
        operationName: { type: "string", minLength: 1 },
        documentPath: { type: "string", minLength: 1 },
        variables: { type: "object" },
        limits: {
          type: "object",
          properties: {
            maxPageSize: { type: "number" },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    cli: {
      type: "object",
      required: ["command"],
      properties: {
        command: { type: "string", minLength: 1 },
        jsonFields: {
          type: "array",
          items: { type: "string", minLength: 1 },
        },
        jq: { type: "string" },
        limits: {
          type: "object",
          properties: {
            maxItemsPerCall: { type: "number" },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    rest: {
      type: "object",
      required: ["endpoints"],
      properties: {
        endpoints: {
          type: "array",
          items: {
            type: "object",
            required: ["method", "path"],
            properties: {
              method: { type: "string" },
              path: { type: "string" },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    examples: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "input"],
        properties: {
          title: { type: "string" },
          input: { type: "object" },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const
