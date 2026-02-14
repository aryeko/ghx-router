import { describe, expect, it, vi } from "vitest"

import type { Scenario } from "../../src/domain/types.js"
import { runScenario } from "../../src/runner/suite-runner.js"

describe("suite-runner scenario validation", () => {
  const issueCommentsScenario: Scenario = {
    id: "issue-comments-list-001",
    name: "Issue comments",
    task: "issue.comments.list" as const,
    input: { owner: "a", name: "b", issueNumber: 1, first: 20 },
    prompt_template: "do {{task}}",
    timeout_ms: 1000,
    allowed_retries: 0,
    assertions: {
      must_succeed: true,
      required_fields: ["ok", "data", "error", "meta"],
      required_data_fields: ["items", "pageInfo"],
      required_meta_fields: ["route_used"],
      expected_route_used: "cli",
      require_tool_calls: true
    },
    tags: []
  }

  const repoScenario: Scenario = {
    id: "repo-view-assertions-001",
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
      required_meta_fields: [],
      require_tool_calls: false
    },
    tags: []
  }

  function createSessionWithTextEnvelope(text: string) {
    return {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn(async () => ({
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
            parts: [
              { type: "text", text },
              { type: "tool", tool: "api-client" },
              { type: "step-finish", reason: "done" }
            ]
          }
        ]
      })),
      abort: vi.fn(async () => ({ data: {} }))
    }
  }

  it("waits for completed assistant output when interim tool-calls message appears", async () => {
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
      "ghx",
      1
    )

    expect(result.success).toBe(true)
    expect(session.promptAsync).toHaveBeenCalledTimes(1)
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
      "ghx",
      1
    )

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain("Output validation failed")
    expect(result.sdk_latency_ms).toBeNull()
  })

  it("uses immediate promptAsync response when session.messages is empty", async () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => ({
        data: {
          info: {
            id: "m1",
            sessionID: "s1",
            role: "assistant",
            time: { created: 1, completed: 2 },
            tokens: { input: 1, output: 2, reasoning: 0, cache: { read: 0, write: 0 } },
            cost: 0
          },
          parts: [
            { type: "text", text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{}}' },
            { type: "tool", tool: "api-client" },
            { type: "step-finish", reason: "done" }
          ]
        }
      })),
      messages: vi.fn(async () => ({ data: [] })),
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
      "ghx",
      1
    )

    expect(result.error?.message ?? "").not.toContain("Timed out waiting for assistant message")
    expect(result.latency_ms_wall).toBeLessThan(1000)
    expect(session.promptAsync).toHaveBeenCalled()
    expect(session.messages).toHaveBeenCalled()
  })

  it("backfills missing envelope fields when assistant already returns ok object", async () => {
    const session = createSessionWithTextEnvelope(
      '{"ok":true,"data":{"items":[],"pageInfo":{"hasNextPage":false,"endCursor":null}}}'
    )

    const result = await runScenario({ session }, issueCommentsScenario, "ghx", 1)

    expect(result.success).toBe(true)
  })

  it("wraps top-level array output into envelope with pagination defaults", async () => {
    const session = createSessionWithTextEnvelope('[{"id":"c1","body":"hello"}]')

    const result = await runScenario({ session }, issueCommentsScenario, "ghx", 1)

    expect(result.success).toBe(true)
  })

  it("wraps repository.issues GraphQL shape into benchmark envelope", async () => {
    const session = createSessionWithTextEnvelope(
      '{"data":{"repository":{"issues":{"nodes":[{"id":"i1"}],"pageInfo":{"hasNextPage":true,"endCursor":"abc"}}}}}'
    )

    const result = await runScenario({ session }, issueCommentsScenario, "ghx", 1)

    expect(result.success).toBe(true)
  })

  it("wraps repository.pullRequests GraphQL shape into benchmark envelope", async () => {
    const session = createSessionWithTextEnvelope(
      '{"data":{"repository":{"pullRequests":{"nodes":[{"id":"pr1"}],"pageInfo":{"hasNextPage":false,"endCursor":null}}}}}'
    )

    const result = await runScenario({ session }, issueCommentsScenario, "ghx", 1)

    expect(result.success).toBe(true)
  })

  it("wraps repository.issue.comments GraphQL shape into benchmark envelope", async () => {
    const session = createSessionWithTextEnvelope(
      '{"data":{"repository":{"issue":{"comments":{"nodes":[{"id":"c1"}],"pageInfo":{"hasNextPage":false,"endCursor":null}}}}}}'
    )

    const result = await runScenario({ session }, issueCommentsScenario, "ghx", 1)

    expect(result.success).toBe(true)
  })

  it("uses structured_output when text does not include an envelope", async () => {
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
              time: { created: 1, completed: 2 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
              structured_output: { ok: true, data: { id: "repo-1" }, error: null, meta: {} }
            },
            parts: [
              { type: "text", text: "not-json" },
              { type: "tool", tool: "api-client" },
              { type: "step-finish", reason: "done" }
            ]
          }
        ]
      })),
      abort: vi.fn(async () => ({ data: {} }))
    }

    const result = await runScenario({ session }, repoScenario, "agent_direct", 1)

    expect(result.success).toBe(true)
    expect(result.output_valid).toBe(true)
  })

  it("requests continuation and accepts immediate continuation payload", async () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi
        .fn()
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({
          data: {
            assistant: {
              id: "m2",
              sessionID: "s1",
              role: "assistant",
              time: { created: 3, completed: 4 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0
            },
            parts: [
              { type: "text", text: '{"ok":true,"data":{"id":"repo-2"},"error":null,"meta":{}}' },
              { type: "tool", tool: "api-client" },
              { type: "step-finish", reason: "done" }
            ]
          }
        }),
      messages: vi.fn(async () => ({
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
            parts: [
              { type: "text", text: "still working" },
              { type: "tool", tool: "api-client" },
              { type: "step-finish", reason: "done" }
            ]
          }
        ]
      })),
      abort: vi.fn(async () => ({ data: {} }))
    }

    const result = await runScenario({ session }, repoScenario, "agent_direct", 1)

    expect(session.promptAsync).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)
    expect(result.output_valid).toBe(true)
  })

  it("backfills missing data and error for envelopes that already include ok", async () => {
    const scenario: Scenario = {
      ...repoScenario,
      assertions: {
        ...repoScenario.assertions,
        required_data_fields: []
      }
    }
    const session = createSessionWithTextEnvelope('{"ok":true,"meta":{}}')

    const result = await runScenario({ session }, scenario, "agent_direct", 1)

    expect(result.success).toBe(true)
    expect(result.output_valid).toBe(true)
  })

  it("keeps raw object when required data fields are missing", async () => {
    const session = createSessionWithTextEnvelope('{"foo":1}')

    const result = await runScenario({ session }, repoScenario, "agent_direct", 1)

    expect(result.success).toBe(false)
    expect(result.output_valid).toBe(false)
  })

})
