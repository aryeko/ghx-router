import { describe, expect, it, vi } from "vitest"

import { runCliAdapter } from "../../src/core/execution/adapters/cli-adapter.js"

describe("runCliAdapter", () => {
  it("returns normalized success when command exits zero", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "ok", stderr: "", exitCode: 0 })),
    }

    const result = await runCliAdapter(runner, {
      command: "gh",
      args: ["repo", "view"],
      reason: "CARD_PREFERRED",
      capabilityId: "repo.view",
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
    expect(result.meta.reason).toBe("CARD_PREFERRED")
    expect(result.data).toEqual({ stdout: "ok", stderr: "", exitCode: 0 })
  })

  it("returns normalized error when command exits non-zero", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "", stderr: "invalid input", exitCode: 1 })),
    }

    const result = await runCliAdapter(runner, {
      command: "gh",
      args: ["repo", "view"],
      capabilityId: "repo.view",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.details).toEqual(
      expect.objectContaining({
        adapter: "cli",
        exitCode: 1,
      }),
    )
  })

  it("uses default args and timeout when omitted", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "ok", stderr: "", exitCode: 0 })),
    }

    const result = await runCliAdapter(runner, {
      command: "gh",
    })

    expect(result.ok).toBe(true)
    expect(runner.run).toHaveBeenCalledWith("gh", [], 10_000)
  })

  it("normalizes thrown runner errors", async () => {
    const runner = {
      run: vi.fn(async () => {
        throw new Error("network down")
      }),
    }

    const result = await runCliAdapter(runner, {
      command: "gh",
      args: ["repo", "view"],
      capabilityId: "repo.view",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain("network down")
    expect(result.error?.details).toEqual(
      expect.objectContaining({
        adapter: "cli",
        command: "gh",
      }),
    )
  })

  it("uses fallback message when stderr is empty", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 9 })),
    }

    const result = await runCliAdapter(runner, {
      command: "gh",
      capabilityId: "repo.view",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain("CLI command failed with exit code 9")
  })

  it("normalizes non-Error throws and default args in catch path", async () => {
    const runner = {
      run: vi.fn(async () => {
        throw "timeout while executing"
      }),
    }

    const result = await runCliAdapter(runner, {
      command: "gh",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain("timeout")
    expect(result.error?.retryable).toBe(true)
    expect(result.error?.details).toEqual(
      expect.objectContaining({
        adapter: "cli",
        args: [],
      }),
    )
  })
})
