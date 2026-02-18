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
        }),
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
        }),
      }
    })

    const { setupCommand } = await import("../../src/cli/commands/setup.js")
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user", "--yes"])

    expect(code).toBe(1)
    expect(stderr.mock.calls.map((call) => String(call[0])).join("")).toContain("Setup failed:")
    expect(stderr.mock.calls.map((call) => String(call[0])).join("")).toContain("access denied")
  })

  it("fails with actionable error when setup skill asset cannot be found", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "ghx-setup-errors-"))
    process.env.HOME = tempRoot

    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>()
      return {
        ...actual,
        readFile: vi.fn(async (path, encoding) => {
          const normalizedPath = String(path).replaceAll("\\", "/")
          if (normalizedPath.includes("/skills/using-ghx/SKILL.md")) {
            const error = new Error("missing") as Error & { code?: string }
            error.code = "ENOENT"
            throw error
          }

          return actual.readFile(path, encoding)
        }),
      }
    })

    const { setupCommand } = await import("../../src/cli/commands/setup.js")
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user", "--yes"])

    expect(code).toBe(1)
    const output = stderr.mock.calls.map((call) => String(call[0])).join("")
    expect(output).toContain("Setup failed: Setup skill asset not found.")
    expect(output).toContain("SKILL.md")
  })

  it("surfaces non-ENOENT asset read errors while loading setup skill content", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "ghx-setup-errors-"))
    process.env.HOME = tempRoot

    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>()
      return {
        ...actual,
        readFile: vi.fn(async (path, encoding) => {
          const normalizedPath = String(path).replaceAll("\\", "/")
          if (normalizedPath.includes("/skills/using-ghx/SKILL.md")) {
            const error = new Error("asset access denied") as Error & { code?: string }
            error.code = "EACCES"
            throw error
          }

          return actual.readFile(path, encoding)
        }),
      }
    })

    const { setupCommand } = await import("../../src/cli/commands/setup.js")
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user", "--yes"])

    expect(code).toBe(1)
    const output = stderr.mock.calls.map((call) => String(call[0])).join("")
    expect(output).toContain("Setup failed:")
    expect(output).toContain("asset access denied")
  })
})
