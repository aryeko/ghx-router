import { logMetric, sanitizeTelemetryContext } from "@core/core/telemetry/logger.js"
import { describe, expect, it, vi } from "vitest"

describe("telemetry logger", () => {
  it("redacts sensitive fields in context", () => {
    const sanitized = sanitizeTelemetryContext({
      token: "abc",
      nested: {
        authorization: "Bearer xyz",
        ok: "value",
      },
    })

    expect(sanitized).toEqual({
      token: "[REDACTED]",
      nested: {
        authorization: "[REDACTED]",
        ok: "value",
      },
    })
  })

  it("logs structured json lines", () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true)
    const originalFlag = process.env.GHX_TELEMETRY_STDOUT
    process.env.GHX_TELEMETRY_STDOUT = "1"

    try {
      logMetric("route.attempt", 1, { capability_id: "repo.view", token: "abc" })

      expect(writeSpy).toHaveBeenCalledTimes(1)
      const output = writeSpy.mock.calls[0]?.[0]
      expect(typeof output).toBe("string")
      const payload = JSON.parse(String(output))
      expect(payload.metric).toBe("route.attempt")
      expect(payload.context.token).toBe("[REDACTED]")
    } finally {
      writeSpy.mockRestore()
      if (originalFlag === undefined) {
        delete process.env.GHX_TELEMETRY_STDOUT
      } else {
        process.env.GHX_TELEMETRY_STDOUT = originalFlag
      }
    }
  })
})
