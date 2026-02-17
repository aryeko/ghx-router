import type { SpawnSyncReturns } from "node:child_process"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}))

import { spawnSync } from "node:child_process"
import { runGh, runGhJson, tryRunGh, tryRunGhJson } from "../../src/fixture/gh-client.js"

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
