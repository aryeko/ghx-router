import { exportSession } from "@bench/runner/session-export.js"
import { describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}))

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

describe("exportSession", () => {
  it("returns ok=true and writes session.jsonl on success", async () => {
    const { spawnSync } = await import("node:child_process")
    const { writeFile } = await import("node:fs/promises")

    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: '{"type":"text","content":"hello"}\n{"type":"text","content":"world"}',
      stderr: "",
      pid: 123,
      output: [],
      signal: null,
    } as unknown as ReturnType<typeof spawnSync>)

    const result = await exportSession({ sessionId: "ses_abc", destDir: "/tmp/iter-1" })

    expect(result).toEqual({ ok: true })
    expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
      expect.stringContaining("session.jsonl"),
      expect.stringContaining('{"type":"text"'),
      "utf8",
    )
  })

  it("returns ok=false when spawnSync has an error", async () => {
    const { spawnSync } = await import("node:child_process")

    vi.mocked(spawnSync).mockReturnValue({
      error: new Error("ENOENT: opencode not found"),
      status: null,
      stdout: "",
      stderr: "",
      pid: 0,
      output: [],
      signal: null,
    } as unknown as ReturnType<typeof spawnSync>)

    const result = await exportSession({ sessionId: "ses_abc", destDir: "/tmp/iter-1" })

    expect(result).toEqual({ ok: false, reason: expect.stringContaining("spawn error") })
  })

  it("returns ok=false when opencode exits with non-zero status", async () => {
    const { spawnSync } = await import("node:child_process")

    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "session not found",
      pid: 123,
      output: [],
      signal: null,
    } as unknown as ReturnType<typeof spawnSync>)

    const result = await exportSession({ sessionId: "ses_missing", destDir: "/tmp/iter-1" })

    expect(result.ok).toBe(false)
    expect((result as { ok: false; reason: string }).reason).toContain("exited 1")
    expect((result as { ok: false; reason: string }).reason).toContain("session not found")
  })

  it("returns ok=false with 'null' status string when process is killed by signal", async () => {
    const { spawnSync } = await import("node:child_process")

    vi.mocked(spawnSync).mockReturnValue({
      status: null,
      stdout: "",
      stderr: "Killed",
      pid: 123,
      output: [],
      signal: "SIGKILL",
    } as unknown as ReturnType<typeof spawnSync>)

    const result = await exportSession({ sessionId: "ses_killed", destDir: "/tmp/iter-1" })

    expect(result.ok).toBe(false)
    expect((result as { ok: false; reason: string }).reason).toContain("null")
  })

  it("returns ok=false with empty stderr message when stderr is not a string", async () => {
    const { spawnSync } = await import("node:child_process")

    vi.mocked(spawnSync).mockReturnValue({
      status: 2,
      stdout: "",
      stderr: null,
      pid: 123,
      output: [],
      signal: null,
    } as unknown as ReturnType<typeof spawnSync>)

    const result = await exportSession({ sessionId: "ses_nonstr", destDir: "/tmp/iter-1" })

    expect(result.ok).toBe(false)
    expect((result as { ok: false; reason: string }).reason).toContain("exited 2")
  })

  it("returns ok=false when stdout is empty", async () => {
    const { spawnSync } = await import("node:child_process")

    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: "   ",
      stderr: "",
      pid: 123,
      output: [],
      signal: null,
    } as unknown as ReturnType<typeof spawnSync>)

    const result = await exportSession({ sessionId: "ses_empty", destDir: "/tmp/iter-1" })

    expect(result).toEqual({ ok: false, reason: "opencode export produced no output" })
  })

  it("passes sessionId to opencode export command", async () => {
    const { spawnSync } = await import("node:child_process")

    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: '{"type":"text"}',
      stderr: "",
      pid: 123,
      output: [],
      signal: null,
    } as unknown as ReturnType<typeof spawnSync>)

    await exportSession({ sessionId: "ses_xyz123", destDir: "/tmp/dest" })

    expect(vi.mocked(spawnSync)).toHaveBeenCalledWith("opencode", ["export", "ses_xyz123"], {
      encoding: "utf8",
      timeout: 30_000,
    })
  })

  it("returns ok=false when writeFile fails with a filesystem error", async () => {
    const { spawnSync } = await import("node:child_process")
    const { writeFile } = await import("node:fs/promises")

    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: '{"type":"text","content":"hello"}',
      stderr: "",
      pid: 123,
      output: [],
      signal: null,
    } as unknown as ReturnType<typeof spawnSync>)

    const eacces = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" })
    vi.mocked(writeFile).mockRejectedValueOnce(eacces)

    const result = await exportSession({ sessionId: "ses_abc", destDir: "/read-only/dir" })

    expect(result).toEqual({ ok: false, reason: expect.stringContaining("write") })
  })
})
