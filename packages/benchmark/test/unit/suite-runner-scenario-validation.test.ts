import { describe, expect, it, vi } from "vitest"

import { runScenario } from "../../src/runner/suite-runner.js"

describe("suite-runner scenario validation", () => {
  it("requests continuation when assistant replies with tool-calls reason", async () => {
    let messagesCallCount = 0
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn(async () => {
        messagesCallCount += 1

        if (messagesCallCount === 1) {
          return {
            data: [
              {
                info: {
                  id: "m1",
                  sessionID: "s1",
                  role: "assistant",
                  time: { created: 1, completed: 2 },
                  tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
                  cost: 0
                },
                parts: [{ type: "step-finish", reason: "tool-calls" }]
              }
            ]
          }
        }

        return {
          data: [
            {
              info: {
                id: "m1",
                sessionID: "s1",
                role: "assistant",
                time: { created: 1, completed: 2 },
                tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
                cost: 0
              },
              parts: [{ type: "step-finish", reason: "tool-calls" }]
            },
            {
              info: {
                id: "m2",
                sessionID: "s1",
                role: "assistant",
                time: { created: 3, completed: 4 },
                tokens: { input: 1, output: 2, reasoning: 0, cache: { read: 0, write: 0 } },
                cost: 0
              },
              parts: [
                { type: "text", text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{}}' },
                { type: "tool", tool: "api-client" },
                { type: "step-finish", reason: "done" }
              ]
            }
          ]
        }
      }),
      abort: vi.fn(async () => ({ data: {} }))
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"]
        },
        tags: []
      },
      "ghx_router",
      1
    )

    expect(result.success).toBe(true)
    expect(session.promptAsync).toHaveBeenCalledTimes(2)
  })

  it("fails output expectation when envelope shape is invalid", async () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m1",
              sessionID: "s1",
              role: "assistant",
              time: { created: 1 },
              tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 0, write: 0 } },
              cost: 0
            },
            parts: [
              { type: "text", text: '{"ok":true,"data":{},"error":null,"meta":{}}' },
              { type: "tool", tool: "api-client" },
              {
                type: "step-finish",
                reason: "done",
                tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 0, write: 0 } },
                cost: 0
              }
            ]
          }
        ]
      })),
      abort: vi.fn(async () => ({ data: {} }))
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
          require_tool_calls: true
        },
        tags: []
      },
      "ghx_router",
      1
    )

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain("Output validation failed")
    expect(result.sdk_latency_ms).toBeNull()
  })
})
