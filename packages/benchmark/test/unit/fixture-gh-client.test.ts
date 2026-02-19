import type { SpawnSyncReturns } from "node:child_process"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}))

import { spawnSync } from "node:child_process"
import {
  runGh,
  runGhJson,
  runGhWithToken,
  tryRunGh,
  tryRunGhJson,
  tryRunGhWithToken,
} from "@bench/fixture/gh-client.js"

describe("runGh", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns stdout on success", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "output\n",
      stderr: "",
    } as SpawnSyncReturns<string>)
    expect(runGh(["repo", "view"])).toBe("output")
  })

  it("throws on non-zero exit with stderr message", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "error message",
    } as SpawnSyncReturns<string>)
    expect(() => runGh(["repo", "view"])).toThrow("error message")
  })

  it("throws with fallback message when stderr is empty", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "",
    } as SpawnSyncReturns<string>)
    expect(() => runGh(["repo", "view"])).toThrow("gh command failed: gh repo view")
  })
})

describe("tryRunGh", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns stdout on success", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "output",
      stderr: "",
    } as SpawnSyncReturns<string>)
    expect(tryRunGh(["repo", "view"])).toBe("output")
  })

  it("returns null on failure", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "error",
    } as SpawnSyncReturns<string>)
    expect(tryRunGh(["repo", "view"])).toBeNull()
  })
})

describe("runGhJson", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("parses JSON from stdout", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: '{"id":1}',
      stderr: "",
    } as SpawnSyncReturns<string>)
    expect(runGhJson(["api", "/repos"])).toEqual({ id: 1 })
  })

  it("returns empty object when stdout is empty", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "",
      stderr: "",
    } as SpawnSyncReturns<string>)
    expect(runGhJson(["api", "/repos"])).toEqual({})
  })

  it("throws on non-zero exit", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "error message",
    } as SpawnSyncReturns<string>)
    expect(() => runGhJson(["api", "/repos"])).toThrow()
  })
})

describe("tryRunGhJson", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns parsed JSON on success", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: '{"id":1}',
      stderr: "",
    } as SpawnSyncReturns<string>)
    expect(tryRunGhJson(["api", "/repos"])).toEqual({ id: 1 })
  })

  it("returns null on failure", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "error",
    } as SpawnSyncReturns<string>)
    expect(tryRunGhJson(["api", "/repos"])).toBeNull()
  })

  it("returns empty object when stdout is empty on success", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "",
      stderr: "",
    } as SpawnSyncReturns<string>)
    expect(tryRunGhJson(["api", "/repos"])).toEqual({})
  })
})

describe("runGhWithToken", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns stdout on success", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "output\n",
      stderr: "",
    } as SpawnSyncReturns<string>)
    expect(runGhWithToken(["repo", "view"], "test-token")).toBe("output")
  })

  it("passes token in environment variable", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "output",
      stderr: "",
    } as SpawnSyncReturns<string>)
    runGhWithToken(["repo", "view"], "test-token")
    const call = vi.mocked(spawnSync).mock.calls.at(0)
    expect(call?.[1]).toEqual(["repo", "view"])
    expect(call?.[2]).toMatchObject({
      encoding: "utf8",
      env: expect.objectContaining({ GH_TOKEN: "test-token" }),
    })
  })

  it("throws on non-zero exit with stderr message", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "error message",
    } as SpawnSyncReturns<string>)
    expect(() => runGhWithToken(["repo", "view"], "test-token")).toThrow("error message")
  })

  it("throws with fallback message when stderr is empty", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "",
    } as SpawnSyncReturns<string>)
    expect(() => runGhWithToken(["repo", "view"], "test-token")).toThrow(
      "gh command failed: gh repo view",
    )
  })

  it("preserves existing environment variables", () => {
    const originalEnv = process.env.EXISTING_VAR
    process.env.EXISTING_VAR = "existing-value"
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "output",
      stderr: "",
    } as SpawnSyncReturns<string>)
    runGhWithToken(["repo", "view"], "test-token")
    const call = vi.mocked(spawnSync).mock.calls.at(0)
    expect((call?.[2]?.env as Record<string, unknown> | undefined)?.EXISTING_VAR).toBe(
      "existing-value",
    )
    if (originalEnv === undefined) {
      delete process.env.EXISTING_VAR
    } else {
      process.env.EXISTING_VAR = originalEnv
    }
  })
})

describe("tryRunGhWithToken", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns stdout on success", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "output",
      stderr: "",
    } as SpawnSyncReturns<string>)
    expect(tryRunGhWithToken(["repo", "view"], "test-token")).toBe("output")
  })

  it("returns null on failure", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "error",
    } as SpawnSyncReturns<string>)
    expect(tryRunGhWithToken(["repo", "view"], "test-token")).toBeNull()
  })

  it("passes token in environment variable", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "output",
      stderr: "",
    } as SpawnSyncReturns<string>)
    tryRunGhWithToken(["repo", "view"], "test-token")
    const call = vi.mocked(spawnSync).mock.calls.at(0)
    expect(call?.[2]).toMatchObject({
      encoding: "utf8",
      env: expect.objectContaining({ GH_TOKEN: "test-token" }),
    })
  })

  it("does not throw on command failure, just returns null", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "error message",
    } as SpawnSyncReturns<string>)
    expect(() => tryRunGhWithToken(["repo", "view"], "test-token")).not.toThrow()
    expect(tryRunGhWithToken(["repo", "view"], "test-token")).toBeNull()
  })
})
