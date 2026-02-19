import { describe, expect, it } from "vitest"
import { runCommand } from "../../src/cli/commands/run.js"
import { formatJson } from "../../src/cli/formatters/json.js"
import { main } from "../../src/cli/index.js"
import { runRestAdapter } from "../../src/core/execution/adapters/rest-adapter.js"
import { routeReasonCodes } from "../../src/core/routing/reason-codes.js"
import { projectName } from "../../src/shared/constants.js"
import { isObject } from "../../src/shared/utils.js"

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
