import { describe, expect, it } from "vitest"
import type {
  CompositeConfig,
  CompositeStep,
  OperationCard,
} from "../../src/core/registry/types.js"

describe("CompositeConfig types", () => {
  it("allows OperationCard with composite field", () => {
    const card: OperationCard = {
      capability_id: "pr.threads.composite",
      version: "1.0.0",
      description: "Batch thread operations",
      input_schema: { type: "object" },
      output_schema: { type: "object" },
      routing: { preferred: "graphql", fallbacks: [] },
      composite: {
        steps: [
          {
            capability_id: "pr.thread.reply",
            foreach: "threads",
            params_map: { threadId: "threadId", body: "body" },
          },
        ],
        output_strategy: "array",
      },
    }
    expect(card.composite).toBeDefined()
    expect(card.composite!.steps).toHaveLength(1)
    expect(card.composite!.output_strategy).toBe("array")
  })

  it("allows OperationCard without composite field", () => {
    const card: OperationCard = {
      capability_id: "repo.view",
      version: "1.0.0",
      description: "View repo",
      input_schema: { type: "object" },
      output_schema: { type: "object" },
      routing: { preferred: "graphql", fallbacks: [] },
    }
    expect(card.composite).toBeUndefined()
  })
})
