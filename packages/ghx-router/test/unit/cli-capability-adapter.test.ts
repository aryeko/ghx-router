import { describe, expect, it, vi } from "vitest"

import { runCliCapability } from "../../src/core/execution/adapters/cli-capability-adapter.js"

describe("runCliCapability", () => {
  it("builds gh args and parses json output", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: '{"id":"repo-id"}', stderr: "", exitCode: 0 }))
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit"
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
    expect(result.data).toEqual({ id: "repo-id" })
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["repo", "view", "acme/modkit", "--json"]),
      10_000
    )
  })

  it("maps cli failures to normalized error", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "", stderr: "unauthorized", exitCode: 1 }))
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit"
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("AUTH")
  })
})
