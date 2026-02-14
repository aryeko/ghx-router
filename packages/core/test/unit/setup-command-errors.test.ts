import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

describe("setupCommand error handling", () => {
  const originalHome = process.env.HOME

  afterEach(() => {
    process.env.HOME = originalHome
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("surfaces non-ENOENT read errors during verify", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "ghx-setup-errors-"))
    process.env.HOME = tempRoot

    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>()
      return {
        ...actual,
        readFile: vi.fn(async () => {
          const error = new Error("permission denied") as Error & { code?: string }
          error.code = "EACCES"
          throw error
        })
      }
    })

    const { setupCommand } = await import("../../src/cli/commands/setup.js")
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user", "--verify"])

    expect(code).toBe(1)
    expect(stderr.mock.calls.map((call) => String(call[0])).join("")).toContain("Setup failed:")
    expect(stderr.mock.calls.map((call) => String(call[0])).join("")).toContain("permission denied")
  })

  it("surfaces non-ENOENT access errors during apply", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "ghx-setup-errors-"))
    process.env.HOME = tempRoot

    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>()
      return {
        ...actual,
        access: vi.fn(async () => {
          const error = new Error("access denied") as Error & { code?: string }
          error.code = "EACCES"
          throw error
        })
      }
    })

    const { setupCommand } = await import("../../src/cli/commands/setup.js")
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user", "--yes"])

    expect(code).toBe(1)
    expect(stderr.mock.calls.map((call) => String(call[0])).join("")).toContain("Setup failed:")
    expect(stderr.mock.calls.map((call) => String(call[0])).join("")).toContain("access denied")
  })
})
