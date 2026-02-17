import { describe, expect, it } from "vitest"
import type { Scenario } from "../../src/domain/types.js"
import {
  buildOutputSchema,
  forcedToolCommandHint,
  modeScopedAssertions,
  renderPrompt,
} from "../../src/runner/prompt/prompt-renderer.js"

const scenario = {
  id: "issue-list-001",
  name: "Issue list",
  task: "issue.list",
  input: { owner: "o", name: "r", state: "open", first: 5 },
  prompt_template: "task={{task}} input={{input_json}}",
  timeout_ms: 1000,
  allowed_retries: 0,
  fixture: { repo: "o/r" },
  assertions: {
    must_succeed: true,
    required_fields: ["ok", "data", "error", "meta"],
    required_data_fields: ["items", "pageInfo"],
    required_meta_fields: ["route_used"],
    expected_route_used: "cli",
  },
  tags: [],
} satisfies Scenario

describe("prompt renderer", () => {
  it("removes strict route requirement for non-ghx modes", () => {
    const scoped = modeScopedAssertions(scenario, "agent_direct")

    expect(scoped.expected_route_used).toBeUndefined()
    expect(scoped.required_meta_fields).toEqual([])
  })

  it("renders task prompt with output contracts", () => {
    const prompt = renderPrompt(scenario, "ghx", "nonce-123")

    expect(prompt).toContain("Target repository: o/r")
    expect(prompt).toContain("Benchmark nonce: nonce-123")
    expect(prompt).toContain("Return STRICT JSON only")
    expect(prompt).toContain("task=issue.list")
  })

  it("builds mode-specific forced command hints", () => {
    const ghxHint = forcedToolCommandHint(scenario, "ghx")
    const directHint = forcedToolCommandHint(scenario, "agent_direct")

    expect(ghxHint).toContain("ghx run issue.list")
    expect(directHint).toContain("gh issue list")
  })

  it("adds custom required meta fields to output schema", () => {
    const schema = buildOutputSchema({
      ...scenario.assertions,
      required_meta_fields: ["route_used", "attempts", "custom_meta"],
    })
    const customMeta = (
      ((schema.properties as Record<string, unknown>).meta as Record<string, unknown>)
        .properties as Record<string, unknown>
    ).custom_meta as Record<string, unknown>

    expect(Array.isArray(customMeta.anyOf)).toBe(true)
    expect((customMeta.anyOf as Array<{ type?: string }>).map((item) => item.type)).toContain(
      "null",
    )
  })

  it("builds direct command hints for list/view tasks and fallback", () => {
    const base = {
      ...scenario,
      input: {
        owner: "octo",
        name: "hello",
        first: 7,
        state: "closed",
        issueNumber: 12,
        prNumber: 34,
      },
      fixture: { repo: "octo/hello" },
    } satisfies Scenario

    expect(
      forcedToolCommandHint({ ...base, task: "issue.comments.list" }, "agent_direct"),
    ).toContain("gh api repos/octo/hello/issues/12/comments?per_page=7&page=1")
    expect(forcedToolCommandHint({ ...base, task: "pr.list" }, "agent_direct")).toContain(
      "gh pr list --repo octo/hello --state closed --limit 7",
    )
    expect(forcedToolCommandHint({ ...base, task: "issue.view" }, "agent_direct")).toContain(
      "gh issue view 12 --repo octo/hello",
    )
    expect(forcedToolCommandHint({ ...base, task: "pr.view" }, "agent_direct")).toContain(
      "gh pr view 34 --repo octo/hello",
    )
    expect(forcedToolCommandHint({ ...base, task: "repo.view" }, "agent_direct")).toContain(
      "gh repo view octo/hello --json",
    )
    expect(forcedToolCommandHint({ ...base, task: "unknown.task" }, "agent_direct")).toBe(
      "gh --version",
    )
  })
})
