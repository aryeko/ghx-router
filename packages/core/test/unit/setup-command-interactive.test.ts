import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

describe("setupCommand interactive overwrite", () => {
  const originalHome = process.env.HOME
  const originalCwd = process.cwd()
  const stdinIsTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY")
  const stdoutIsTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY")

  afterEach(() => {
    process.env.HOME = originalHome
    process.chdir(originalCwd)
    vi.restoreAllMocks()
    vi.resetModules()

    if (stdinIsTTYDescriptor) {
      Object.defineProperty(process.stdin, "isTTY", stdinIsTTYDescriptor)
    }

    if (stdoutIsTTYDescriptor) {
      Object.defineProperty(process.stdout, "isTTY", stdoutIsTTYDescriptor)
    }
  })

  it("overwrites existing skill when interactive prompt approves", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "ghx-setup-interactive-"))
    process.env.HOME = tempRoot

    vi.doMock("node:readline/promises", () => ({
      default: {
        createInterface: vi.fn(() => ({
          question: vi.fn(async () => "y"),
          close: vi.fn(),
        })),
      },
    }))

    const { setupCommand } = await import("@core/cli/commands/setup.js")
    await setupCommand(["--scope", "user", "--yes"])

    const skillPath = join(tempRoot, ".agents", "skills", "ghx", "SKILL.md")
    writeFileSync(skillPath, "custom content", "utf8")

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })

    const code = await setupCommand(["--scope", "user"])

    expect(code).toBe(0)
    expect(readFileSync(skillPath, "utf8")).toContain("## Execute")
  })

  it("keeps existing skill when interactive prompt declines", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "ghx-setup-interactive-"))
    process.env.HOME = tempRoot

    vi.doMock("node:readline/promises", () => ({
      default: {
        createInterface: vi.fn(() => ({
          question: vi.fn(async () => "n"),
          close: vi.fn(),
        })),
      },
    }))

    const { setupCommand } = await import("@core/cli/commands/setup.js")
    await setupCommand(["--scope", "user", "--yes"])

    const skillPath = join(tempRoot, ".agents", "skills", "ghx", "SKILL.md")
    writeFileSync(skillPath, "custom content", "utf8")

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user"])

    expect(code).toBe(1)
    expect(stderr.mock.calls.map((call) => String(call[0])).join("")).toContain("already exists")
    expect(readFileSync(skillPath, "utf8")).toBe("custom content")
  })
})
