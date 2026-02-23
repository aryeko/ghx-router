import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { buildLogFilePath, createLogger, createLoggerConfig } from "@core/core/telemetry/log.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:fs", () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
  appendFile: vi.fn((_path: unknown, _data: unknown, cb: unknown) => (cb as () => void)()),
}))

const mockAppendFile = vi.mocked(fs.appendFile)
const mockMkdir = vi.mocked(fs.promises.mkdir)

describe("buildLogFilePath", () => {
  it("formats path with YYYY-MM-DD (UTC)", () => {
    const date = new Date(Date.UTC(2026, 1, 23, 10, 0, 0))
    const result = buildLogFilePath("/tmp/logs", date)
    expect(result).toBe(path.join("/tmp/logs", "ghx-2026-02-23.jsonl"))
  })

  it("pads month and day with leading zeros", () => {
    const date = new Date(Date.UTC(2026, 2, 5, 0, 0, 0))
    const result = buildLogFilePath("/logs", date)
    expect(result).toMatch(/ghx-2026-03-05\.jsonl$/)
  })
})

describe("createLoggerConfig", () => {
  const originalLevel = process.env.GHX_LOG_LEVEL
  const originalDir = process.env.GHX_LOG_DIR

  beforeEach(() => {
    if (originalLevel === undefined) {
      delete process.env.GHX_LOG_LEVEL
    } else {
      process.env.GHX_LOG_LEVEL = originalLevel
    }
    if (originalDir === undefined) {
      delete process.env.GHX_LOG_DIR
    } else {
      process.env.GHX_LOG_DIR = originalDir
    }
  })

  it("returns level off when GHX_LOG_LEVEL is unset", () => {
    delete process.env.GHX_LOG_LEVEL
    const config = createLoggerConfig()
    expect(config.level).toBe("off")
  })

  it("picks up GHX_LOG_LEVEL=debug", () => {
    process.env.GHX_LOG_LEVEL = "debug"
    const config = createLoggerConfig()
    expect(config.level).toBe("debug")
  })

  it("picks up GHX_LOG_LEVEL=warn", () => {
    process.env.GHX_LOG_LEVEL = "warn"
    const config = createLoggerConfig()
    expect(config.level).toBe("warn")
  })

  it("falls back to info for unknown level values", () => {
    process.env.GHX_LOG_LEVEL = "verbose"
    const config = createLoggerConfig()
    expect(config.level).toBe("info")
  })

  it("uses default dir when GHX_LOG_DIR is unset", () => {
    delete process.env.GHX_LOG_DIR
    const config = createLoggerConfig()
    expect(config.dir).toBe(path.join(os.homedir(), ".ghx", "logs"))
  })

  it("picks up GHX_LOG_DIR", () => {
    process.env.GHX_LOG_DIR = "/custom/log/dir"
    const config = createLoggerConfig()
    expect(config.dir).toBe("/custom/log/dir")
  })

  it("includes pid and ppid", () => {
    const config = createLoggerConfig()
    expect(config.pid).toBe(process.pid)
    expect(config.ppid).toBe(process.ppid)
  })
})

describe("createLogger — off level", () => {
  beforeEach(() => {
    mockAppendFile.mockClear()
    mockMkdir.mockClear()
  })

  it("all methods are no-ops (no file IO)", () => {
    const logger = createLogger({
      level: "off",
      dir: "/tmp/ghx-test-logs",
      pid: 1,
      ppid: 0,
    })

    logger.debug("should not write")
    logger.info("should not write")
    logger.warn("should not write")
    logger.error("should not write")

    expect(mockMkdir).not.toHaveBeenCalled()
    expect(mockAppendFile).not.toHaveBeenCalled()
  })
})

describe("createLogger — active level", () => {
  beforeEach(() => {
    mockAppendFile.mockClear()
    mockMkdir.mockClear()
    mockMkdir.mockResolvedValue(undefined)
    mockAppendFile.mockImplementation((_path: unknown, _data: unknown, cb: unknown) =>
      (cb as () => void)(),
    )
  })

  it("debug call is no-op when level is info", async () => {
    const logger = createLogger({
      level: "info",
      dir: "/tmp/ghx-test-logs",
      pid: 1,
      ppid: 0,
    })

    logger.debug("should be filtered")
    await new Promise((r) => setTimeout(r, 10))
    expect(mockAppendFile).not.toHaveBeenCalled()
  })

  it("info/warn/error calls write when level is info", async () => {
    const logger = createLogger({
      level: "info",
      dir: "/tmp/ghx-test-logs",
      pid: 1,
      ppid: 0,
    })

    logger.info("hello")
    logger.warn("world")
    logger.error("oops")

    await new Promise((r) => setTimeout(r, 10))
    expect(mockAppendFile).toHaveBeenCalledTimes(3)
  })

  it("all levels write when level is debug", async () => {
    const logger = createLogger({
      level: "debug",
      dir: "/tmp/ghx-test-logs",
      pid: 1,
      ppid: 0,
    })

    logger.debug("d")
    logger.info("i")
    logger.warn("w")
    logger.error("e")

    await new Promise((r) => setTimeout(r, 10))
    expect(mockAppendFile).toHaveBeenCalledTimes(4)
  })

  it("written lines are valid JSON with required fields", async () => {
    const logger = createLogger({
      level: "debug",
      dir: "/tmp/ghx-test-logs",
      pid: 42,
      ppid: 10,
    })

    logger.info("test.event", { capability_id: "repo.view" })

    await new Promise((r) => setTimeout(r, 10))
    const writtenData = String(mockAppendFile.mock.calls[0]?.[1])
    const parsed = JSON.parse(writtenData.trim())

    expect(parsed).toMatchObject({
      level: "info",
      msg: "test.event",
      pid: 42,
      ppid: 10,
      capability_id: "repo.view",
    })
    expect(typeof parsed.ts).toBe("string")
    expect(typeof parsed.version).toBe("string")
  })

  it("redacts sensitive keys in context", async () => {
    const logger = createLogger({
      level: "debug",
      dir: "/tmp/ghx-test-logs",
      pid: 1,
      ppid: 0,
    })

    logger.info("auth.check", { token: "secret-abc", user: "alice" })

    await new Promise((r) => setTimeout(r, 10))
    const writtenData = String(mockAppendFile.mock.calls[0]?.[1])
    const parsed = JSON.parse(writtenData.trim())

    expect(parsed.token).toBe("[REDACTED]")
    expect(parsed.user).toBe("alice")
  })

  it("file write errors are silently swallowed", async () => {
    mockAppendFile.mockImplementation((_path: unknown, _data: unknown, cb: unknown) =>
      (cb as (err: Error) => void)(new Error("disk full")),
    )

    const logger = createLogger({
      level: "info",
      dir: "/tmp/ghx-test-logs",
      pid: 1,
      ppid: 0,
    })

    expect(() => logger.info("should not throw")).not.toThrow()
    await new Promise((r) => setTimeout(r, 10))
    // No unhandled rejection — test passes if we reach here
  })
})
