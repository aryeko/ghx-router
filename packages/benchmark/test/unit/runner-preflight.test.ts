import { describe, expect, it, vi } from "vitest"
import type { Scenario } from "../../src/domain/types.js"
import { assertGhxRouterPreflight, ghOk } from "../../src/runner/preflight/ghx-router-preflight.js"

const scenario = {
  id: "repo-view-001",
  name: "Repo view",
  task: "repo.view",
  input: { owner: "o", name: "r" },
  prompt_template: "run {{task}} {{input_json}}",
  timeout_ms: 1000,
  allowed_retries: 0,
  fixture: { repo: "o/r" },
  assertions: {
    must_succeed: true,
    required_fields: ["ok", "data", "error", "meta"],
    required_data_fields: ["id"],
  },
  tags: [],
} satisfies Scenario

describe("ghx router preflight", () => {
  it("reports gh availability from spawn result", () => {
    const ok = ghOk(
      ["--version"],
      vi.fn(() => ({ status: 0 })),
    )
    const notOk = ghOk(
      ["--version"],
      vi.fn(() => ({ status: 1 })),
    )

    expect(ok).toBe(true)
    expect(notOk).toBe(false)
  })

  it("passes when auth and capabilities checks are satisfied", () => {
    const spawn = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stderr: "" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([{ capability_id: "repo.view" }]),
        stderr: "",
      })

    expect(() =>
      assertGhxRouterPreflight([scenario], {
        ghxCommand: "/tmp/ghx",
        ensureGhxAliasReady: () => undefined,
        spawnSyncFn: spawn,
      }),
    ).not.toThrow()
  })

  it("fails when required capability is missing", () => {
    const spawn = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stderr: "" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([{ capability_id: "issue.view" }]),
        stderr: "",
      })

    expect(() =>
      assertGhxRouterPreflight([scenario], {
        ghxCommand: "/tmp/ghx",
        ensureGhxAliasReady: () => undefined,
        spawnSyncFn: spawn,
      }),
    ).toThrow("missing capabilities")
  })

  it("fails with fallback messages when auth or capabilities command fails", () => {
    const authFails = vi.fn().mockReturnValueOnce({ status: 1, stderr: "" })
    expect(() =>
      assertGhxRouterPreflight([scenario], {
        ghxCommand: "/tmp/ghx",
        ensureGhxAliasReady: () => undefined,
        spawnSyncFn: authFails,
      }),
    ).toThrow("gh auth status failed")

    const capabilitiesFail = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stderr: "" })
      .mockReturnValueOnce({ status: 1, stderr: "" })
    expect(() =>
      assertGhxRouterPreflight([scenario], {
        ghxCommand: "/tmp/ghx",
        ensureGhxAliasReady: () => undefined,
        spawnSyncFn: capabilitiesFail,
      }),
    ).toThrow("failed to list ghx capabilities")
  })

  it("fails for invalid capabilities JSON payloads", () => {
    const invalidJson = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "{not-json", stderr: "" })
    expect(() =>
      assertGhxRouterPreflight([scenario], {
        ghxCommand: "/tmp/ghx",
        ensureGhxAliasReady: () => undefined,
        spawnSyncFn: invalidJson,
      }),
    ).toThrow("ghx capabilities JSON invalid")

    const nonArrayJson = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ capability_id: "repo.view" }) })
    expect(() =>
      assertGhxRouterPreflight([scenario], {
        ghxCommand: "/tmp/ghx",
        ensureGhxAliasReady: () => undefined,
        spawnSyncFn: nonArrayJson,
      }),
    ).toThrow("expected array")

    const emptyJson = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "   " })
    expect(() =>
      assertGhxRouterPreflight([scenario], {
        ghxCommand: "/tmp/ghx",
        ensureGhxAliasReady: () => undefined,
        spawnSyncFn: emptyJson,
      }),
    ).toThrow("returned no capabilities")
  })

  it("fails on win32 platform", () => {
    const platformSpy = vi.spyOn(process, "platform", "get").mockReturnValue("win32")

    try {
      expect(() =>
        assertGhxRouterPreflight([scenario], {
          ghxCommand: "/tmp/ghx",
          ensureGhxAliasReady: () => undefined,
          spawnSyncFn: vi.fn(),
        }),
      ).toThrow("supports Unix-like environments only")
    } finally {
      platformSpy.mockRestore()
    }
  })
})
