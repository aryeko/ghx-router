import { runCommand } from "@core/cli/commands/run.js"
import { formatJson } from "@core/cli/formatters/json.js"
import { main } from "@core/cli/index.js"
import { runRestAdapter } from "@core/core/execution/adapters/rest-adapter.js"
import { routeReasonCodes } from "@core/core/routing/reason-codes.js"
import { projectName } from "@core/shared/constants.js"
import { isObject } from "@core/shared/utils.js"
import { describe, expect, it } from "vitest"

describe("scaffolds and constants", () => {
  it("executes scaffold command entrypoints without throwing", () => {
    expect(() => main()).not.toThrow()
    expect(() => runCommand()).not.toThrow()
  })

  it("formats simple outputs", () => {
    expect(formatJson({ a: 1 })).toContain('"a": 1')
  })

  it("exposes routing reasons", () => {
    expect(routeReasonCodes).toContain("CARD_FALLBACK")
  })

  it("exports shared utility primitives", () => {
    expect(projectName).toBe("ghx")
    expect(isObject({})).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
  })

  it("throws for unimplemented rest adapter", async () => {
    await expect(runRestAdapter()).rejects.toThrow("not implemented")
  })
})
