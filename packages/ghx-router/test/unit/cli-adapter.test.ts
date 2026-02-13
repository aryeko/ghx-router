import { describe, expect, it, vi } from "vitest"

import { runCliAdapter } from "../../src/core/execution/adapters/cli-adapter.js"

describe("runCliAdapter", () => {
  it("returns normalized success when command exits zero", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "ok", stderr: "", exitCode: 0 }))
    }

    const result = await runCliAdapter(runner, {
      command: "gh",
      args: ["repo", "view"],
      reason: "CARD_PREFERRED",
      capabilityId: "repo.view"
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
    expect(result.meta.reason).toBe("CARD_PREFERRED")
    expect(result.data).toEqual({ stdout: "ok", stderr: "", exitCode: 0 })
  })

  it("returns normalized error when command exits non-zero", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "", stderr: "invalid input", exitCode: 1 }))
    }

    const result = await runCliAdapter(runner, {
      command: "gh",
      args: ["repo", "view"],
      capabilityId: "repo.view"
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.details).toEqual(
      expect.objectContaining({
        adapter: "cli",
        exitCode: 1
      })
    )
  })
})
