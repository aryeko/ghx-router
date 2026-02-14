import { describe, expect, it, vi } from "vitest"
import { EventEmitter } from "node:events"

import { createSafeCliCommandRunner } from "../../src/core/execution/cli/safe-runner.js"

describe("createSafeCliCommandRunner", () => {
  it("returns stdout, stderr, and exitCode for successful command", async () => {
    const runner = createSafeCliCommandRunner()

    const result = await runner.run(
      process.execPath,
      ["-e", "process.stdout.write('ok'); process.stderr.write('warn')"],
      1000
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe("ok")
    expect(result.stderr).toBe("warn")
  })

  it("rejects when command exceeds timeout", async () => {
    const runner = createSafeCliCommandRunner()

    await expect(
      runner.run(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], 20)
    ).rejects.toThrow("timed out")
  })

  it("rejects when combined output exceeds configured bounds", async () => {
    const runner = createSafeCliCommandRunner({ maxOutputBytes: 64 })

    await expect(
      runner.run(process.execPath, ["-e", "process.stdout.write('x'.repeat(256))"], 1000)
    ).rejects.toThrow("output exceeded")
  })

  it("rejects when stderr output exceeds configured bounds", async () => {
    const runner = createSafeCliCommandRunner({ maxOutputBytes: 64 })

    await expect(
      runner.run(process.execPath, ["-e", "process.stderr.write('x'.repeat(256))"], 1000)
    ).rejects.toThrow("output exceeded")
  })

  it("returns non-zero exit code without throwing", async () => {
    const runner = createSafeCliCommandRunner()

    const result = await runner.run(process.execPath, ["-e", "process.exit(42)"], 1000)

    expect(result.exitCode).toBe(42)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe("")
  })

  it("rejects when spawn fails", async () => {
    const runner = createSafeCliCommandRunner()

    await expect(runner.run("definitely-not-a-real-command-ghx", [], 1000)).rejects.toThrow()
  })

  it("rejects when timeout is non-positive", async () => {
    const runner = createSafeCliCommandRunner()

    await expect(runner.run(process.execPath, ["-e", "process.stdout.write('ok')"], 0)).rejects.toThrow(
      "timeoutMs must be a positive number"
    )
  })

  it("ignores duplicate settle signals and post-overflow stream chunks", async () => {
    const stdout = new EventEmitter()
    const stderr = new EventEmitter()
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter
      stderr: EventEmitter
      kill: (signal: string) => void
    }
    child.stdout = stdout
    child.stderr = stderr
    child.kill = vi.fn()

    const spawnMock = vi.fn(() => child)
    vi.resetModules()
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }))

    try {
      const { createSafeCliCommandRunner: createMockedRunner } = await import(
        "../../src/core/execution/cli/safe-runner.js"
      )
      const runner = createMockedRunner({ maxOutputBytes: 4 })

      const pending = runner.run("gh", ["repo", "view"], 200)

      stdout.emit("data", Buffer.from("abc"))
      stdout.emit("data", Buffer.from("de"))
      stdout.emit("data", Buffer.from("ignored-after-overflow"))
      stderr.emit("data", Buffer.from("ignored-too"))
      child.emit("error", new Error("first failure"))
      child.emit("close", 0)

      await expect(pending).rejects.toThrow("output exceeded")
      expect(child.kill).toHaveBeenCalledWith("SIGKILL")
    } finally {
      vi.doUnmock("node:child_process")
      vi.resetModules()
    }
  })

  it("rejects immediately on overflow before close event", async () => {
    const stdout = new EventEmitter()
    const stderr = new EventEmitter()
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter
      stderr: EventEmitter
      kill: (signal: string) => void
    }
    child.stdout = stdout
    child.stderr = stderr
    child.kill = vi.fn()

    const spawnMock = vi.fn(() => child)
    vi.resetModules()
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }))

    try {
      const { createSafeCliCommandRunner: createMockedRunner } = await import(
        "../../src/core/execution/cli/safe-runner.js"
      )
      const runner = createMockedRunner({ maxOutputBytes: 4 })

      const pending = runner.run("gh", ["repo", "view"], 200)

      stdout.emit("data", Buffer.from("abcde"))
      await expect(pending).rejects.toThrow("output exceeded")
      expect(child.kill).toHaveBeenCalledTimes(1)
      child.emit("close", 0)
    } finally {
      vi.doUnmock("node:child_process")
      vi.resetModules()
    }
  })

  it("collects stdout and stderr chunks when under size limit", async () => {
    const stdout = new EventEmitter()
    const stderr = new EventEmitter()
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter
      stderr: EventEmitter
      kill: (signal: string) => void
    }
    child.stdout = stdout
    child.stderr = stderr
    child.kill = vi.fn()

    const spawnMock = vi.fn(() => child)
    vi.resetModules()
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }))

    try {
      const { createSafeCliCommandRunner: createMockedRunner } = await import(
        "../../src/core/execution/cli/safe-runner.js"
      )
      const runner = createMockedRunner({ maxOutputBytes: 1024 })

      const pending = runner.run("gh", ["repo", "view"], 200)

      stdout.emit("data", Buffer.from("ok"))
      stderr.emit("data", Buffer.from("warn"))
      child.emit("close", 0)

      await expect(pending).resolves.toEqual({
        stdout: "ok",
        stderr: "warn",
        exitCode: 0
      })
    } finally {
      vi.doUnmock("node:child_process")
      vi.resetModules()
    }
  })

  it("reports overflow even when close happens after timeout window", async () => {
    const stdout = new EventEmitter()
    const stderr = new EventEmitter()
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter
      stderr: EventEmitter
      kill: (signal: string) => void
    }
    child.stdout = stdout
    child.stderr = stderr
    child.kill = vi.fn()

    const spawnMock = vi.fn(() => child)
    vi.resetModules()
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }))

    try {
      const { createSafeCliCommandRunner: createMockedRunner } = await import(
        "../../src/core/execution/cli/safe-runner.js"
      )
      const runner = createMockedRunner({ maxOutputBytes: 4 })

      const pending = runner
        .run("gh", ["repo", "view"], 20)
        .then<Error>(() => new Error("expected overflow rejection"))
        .catch((error: Error) => error)

      stdout.emit("data", Buffer.from("abcde"))
      await new Promise((resolve) => setTimeout(resolve, 50))
      child.emit("close", 0)

      const error = await pending
      expect(error.message).toContain("output exceeded")
      expect(child.kill).toHaveBeenCalledWith("SIGKILL")
    } finally {
      vi.doUnmock("node:child_process")
      vi.resetModules()
    }
  })
})
