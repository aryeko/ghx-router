import { expandCompositeSteps } from "@core/core/execute/composite.js"
import type { CompositeConfig } from "@core/core/registry/types.js"
import { describe, expect, it } from "vitest"

describe("expandCompositeSteps", () => {
  it("throws when foreach key is not an array", () => {
    const composite: CompositeConfig = {
      steps: [
        {
          capability_id: "pr.thread.reply",
          foreach: "threads",
          params_map: { threadId: "threadId", body: "body" },
        },
      ],
      output_strategy: "array",
    }

    expect(() => expandCompositeSteps(composite, { threads: "bad" as unknown as [] })).toThrow(
      'Composite foreach key "threads" must be an array, got string',
    )
  })

  it("uses all step capability ids when action is absent", () => {
    const composite: CompositeConfig = {
      steps: [
        {
          capability_id: "pr.thread.reply",
          params_map: { threadId: "threadId", body: "body" },
        },
        {
          capability_id: "pr.thread.resolve",
          params_map: { threadId: "threadId" },
        },
      ],
      output_strategy: "array",
    }

    const operations = expandCompositeSteps(composite, {
      threadId: "T_1",
      body: "reply body",
    })

    expect(operations).toHaveLength(2)
    expect(operations.map((op) => op.alias)).toEqual(["pr_thread_reply_0", "pr_thread_resolve_1"])
  })

  it("throws when a step has no registered operation builder", () => {
    const composite: CompositeConfig = {
      steps: [
        {
          capability_id: "pr.thread.reply",
          params_map: { threadId: "threadId", body: "body" },
        },
        {
          capability_id: "pr.thread.missing",
          params_map: { threadId: "threadId" },
        },
      ],
      output_strategy: "array",
    }

    expect(() =>
      expandCompositeSteps(composite, {
        threadId: "T_1",
        body: "reply body",
      }),
    ).toThrow("No builder registered for capability: pr.thread.missing")
  })

  it("throws when action is not mapped by composite steps", () => {
    const composite: CompositeConfig = {
      steps: [
        {
          capability_id: "pr.thread.reply",
          foreach: "threads",
          actions: ["reply", "reply_and_resolve"],
          params_map: { threadId: "threadId", body: "body" },
        },
        {
          capability_id: "pr.thread.resolve",
          foreach: "threads",
          actions: ["resolve", "reply_and_resolve"],
          params_map: { threadId: "threadId" },
        },
      ],
      output_strategy: "array",
    }

    expect(() =>
      expandCompositeSteps(composite, {
        threads: [{ threadId: "T_1", action: "unknown_action", body: "reply body" }],
      }),
    ).toThrow('Invalid action "unknown_action" for composite item at index 0')
  })

  it("throws when foreach contains non-object items", () => {
    const composite: CompositeConfig = {
      steps: [
        {
          capability_id: "pr.thread.resolve",
          foreach: "threads",
          params_map: { threadId: "threadId" },
        },
      ],
      output_strategy: "array",
    }

    expect(() =>
      expandCompositeSteps(composite, {
        threads: ["bad-item"],
      }),
    ).toThrow("Composite foreach item at index 0 must be an object")
  })

  it("skips step when requires_any_of fields are all missing", () => {
    const composite: CompositeConfig = {
      steps: [
        {
          capability_id: "pr.thread.reply",
          requires_any_of: ["body"],
          params_map: { threadId: "threadId", body: "body" },
        },
        {
          capability_id: "pr.thread.resolve",
          params_map: { threadId: "threadId" },
        },
      ],
      output_strategy: "array",
    }

    const operations = expandCompositeSteps(composite, { threadId: "T_1" })
    expect(operations).toHaveLength(1)
    expect(operations[0]?.alias).toBe("pr_thread_resolve_0")
  })
})
