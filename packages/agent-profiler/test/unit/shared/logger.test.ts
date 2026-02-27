import { createLogger } from "@profiler/shared/logger.js"
import { describe, expect, it, vi } from "vitest"

describe("createLogger", () => {
  it("logs messages at or above the configured level", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})
    const logger = createLogger("info")
    logger.info("hello")
    expect(spy).toHaveBeenCalledWith("[INFO] hello")
    spy.mockRestore()
  })

  it("suppresses messages below the configured level", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {})
    const logger = createLogger("info")
    logger.debug("suppressed")
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it("allows debug messages at debug level", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {})
    const logger = createLogger("debug")
    logger.debug("visible")
    expect(spy).toHaveBeenCalledWith("[DEBUG] visible")
    spy.mockRestore()
  })

  it("always allows error messages", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const logger = createLogger("error")
    logger.error("critical")
    expect(spy).toHaveBeenCalledWith("[ERROR] critical")
    spy.mockRestore()
  })

  it("passes additional arguments to console methods", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const logger = createLogger("warn")
    logger.warn("warning", { detail: "extra" })
    expect(spy).toHaveBeenCalledWith("[WARN] warning", { detail: "extra" })
    spy.mockRestore()
  })

  it("exposes all four logging methods", () => {
    const logger = createLogger("debug")
    expect(typeof logger.debug).toBe("function")
    expect(typeof logger.info).toBe("function")
    expect(typeof logger.warn).toBe("function")
    expect(typeof logger.error).toBe("function")
  })
})
