import { describe, expect, it } from "vitest"
import type { Scenario } from "../../src/domain/types.js"
import {
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
})
