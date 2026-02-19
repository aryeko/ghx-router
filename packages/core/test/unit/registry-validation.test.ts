import { validateOperationCard } from "@core/core/registry/index.js"
import { describe, expect, it } from "vitest"

describe("validateOperationCard", () => {
  const validBaseCard = {
    capability_id: "test.card",
    version: "1.0.0",
    description: "Test",
    input_schema: { type: "object" },
    output_schema: { type: "object" },
    routing: {
      preferred: "graphql" as const,
      fallbacks: [] as readonly string[],
    },
  }

  it("rejects malformed operation cards", () => {
    expect(validateOperationCard(null).ok).toBe(false)
    expect(
      validateOperationCard({
        capability_id: "x",
        version: "1",
        description: "d",
        input_schema: {},
        output_schema: {},
        routing: { preferred: "invalid", fallbacks: [] },
      }).ok,
    ).toBe(false)
    expect(
      validateOperationCard({
        capability_id: "x",
        version: "1",
        description: "d",
        input_schema: {},
        output_schema: {},
        routing: { preferred: "cli", fallbacks: "bad" },
      }).ok,
    ).toBe(false)
  })

  it("accepts a valid operation card", () => {
    const result = validateOperationCard({
      capability_id: "repo.view",
      version: "1.0.0",
      description: "Repo",
      input_schema: {},
      output_schema: {},
      routing: {
        preferred: "graphql",
        fallbacks: ["cli"],
      },
    })

    expect(result.ok).toBe(true)
  })

  it("accepts card with valid composite config", () => {
    const card = {
      ...validBaseCard,
      capability_id: "pr.threads.composite",
      composite: {
        steps: [
          {
            capability_id: "pr.thread.reply",
            foreach: "threads",
            params_map: { threadId: "threadId" },
          },
        ],
        output_strategy: "array",
      },
    }
    const result = validateOperationCard(card)
    expect(result.ok).toBe(true)
  })

  it("rejects card with invalid output_strategy", () => {
    const card = {
      ...validBaseCard,
      composite: {
        steps: [{ capability_id: "pr.thread.reply", params_map: {} }],
        output_strategy: "invalid",
      },
    }
    const result = validateOperationCard(card)
    expect(result.ok).toBe(false)
  })

  it("rejects composite with empty steps array", () => {
    const card = {
      ...validBaseCard,
      composite: {
        steps: [],
        output_strategy: "array",
      },
    }
    const result = validateOperationCard(card)
    expect(result.ok).toBe(false)
  })
})
