import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { afterEach, describe, expect, it, vi } from "vitest"

import { setupCommand } from "../../src/cli/commands/setup.js"

describe("setup command", () => {
  const tempRoots: string[] = []

  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(tempRoots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })))
  })

  it("prints a dry-run plan without writing files", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-setup-dry-run-"))
    tempRoots.push(root)

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await setupCommand(["--platform", "claude-code", "--scope", "project", "--dry-run"], {
      cwd: root,
      homeDir: root,
      nowMs: () => 1700000000000
    })

    const targetPath = join(root, ".claude", "skills", "ghx", "SKILL.md")
    const exists = await stat(targetPath).then(() => true).catch(() => false)

    expect(code).toBe(0)
    expect(exists).toBe(false)
    expect(stdout).toHaveBeenCalledWith(`DRY RUN: install profile pr-review-ci to ${targetPath}\n`)
  })

  it("writes the skill file for project scope", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-setup-project-"))
    tempRoots.push(root)

    const code = await setupCommand(["--platform", "claude-code", "--scope", "project"], {
      cwd: root,
      homeDir: root,
      nowMs: () => 1700000000000
    })

    const targetPath = join(root, ".claude", "skills", "ghx", "SKILL.md")
    const content = await readFile(targetPath, "utf8")

    expect(code).toBe(0)
    expect(content).toContain("Use execute(capability_id, params)")
  })

  it("writes user-scope opencode setup to the user config path", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-setup-opencode-user-"))
    tempRoots.push(root)

    const code = await setupCommand(["--platform", "opencode", "--scope", "user"], {
      cwd: join(root, "workspace"),
      homeDir: root,
      nowMs: () => 1700000000000
    })

    const targetPath = join(root, ".config", "opencode", "skills", "ghx", "SKILL.md")
    const content = await readFile(targetPath, "utf8")

    expect(code).toBe(0)
    expect(content).toContain("profile: pr-review-ci")
  })

  it("is idempotent when rerun with unchanged content", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-setup-idempotent-"))
    tempRoots.push(root)
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    await setupCommand(["--platform", "claude-code", "--scope", "project"], {
      cwd: root,
      homeDir: root,
      nowMs: () => 1700000000000
    })

    const code = await setupCommand(["--platform", "claude-code", "--scope", "project"], {
      cwd: root,
      homeDir: root,
      nowMs: () => 1700000001000
    })

    expect(code).toBe(0)
    expect(stdout).toHaveBeenCalledWith("Already configured: no changes required\n")
  })

  it("requires --yes before overwrite and creates backup with --yes", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-setup-overwrite-"))
    tempRoots.push(root)
    const targetPath = join(root, ".claude", "skills", "ghx", "SKILL.md")

    await setupCommand(["--platform", "claude-code", "--scope", "project"], {
      cwd: root,
      homeDir: root,
      nowMs: () => 1700000000000
    })
    await writeFile(targetPath, "custom content", "utf8")

    await expect(
      setupCommand(["--platform", "claude-code", "--scope", "project"], {
        cwd: root,
        homeDir: root,
        nowMs: () => 1700000001000
      })
    ).rejects.toThrow("Refusing to overwrite existing setup")

    const code = await setupCommand(["--platform", "claude-code", "--scope", "project", "--yes"], {
      cwd: root,
      homeDir: root,
      nowMs: () => 1700000002000
    })

    const backupPath = `${targetPath}.bak.1700000002000`
    const backupContent = await readFile(backupPath, "utf8")
    expect(code).toBe(0)
    expect(backupContent).toBe("custom content")
  })

  it("verify mode checks whether setup file exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-setup-verify-"))
    tempRoots.push(root)

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const missingCode = await setupCommand(["--platform", "claude-code", "--scope", "project", "--verify"], {
      cwd: root,
      homeDir: root,
      nowMs: () => 1700000000000
    })

    await setupCommand(["--platform", "claude-code", "--scope", "project"], {
      cwd: root,
      homeDir: root,
      nowMs: () => 1700000000000
    })

    const successCode = await setupCommand(["--platform", "claude-code", "--scope", "project", "--verify"], {
      cwd: root,
      homeDir: root,
      nowMs: () => 1700000001000
    })

    expect(missingCode).toBe(1)
    expect(successCode).toBe(0)
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("VERIFY"))
  })

  it("rejects invalid argument combinations", async () => {
    await expect(
      setupCommand(["--platform", "claude-code", "--scope", "project", "--verify", "--dry-run"], {
        cwd: "/tmp/test",
        homeDir: "/tmp/test",
        nowMs: () => 1700000000000
      })
    ).rejects.toThrow("cannot be used together")

    await expect(
      setupCommand(["--platform", "claude-code"], {
        cwd: "/tmp/test",
        homeDir: "/tmp/test",
        nowMs: () => 1700000000000
      })
    ).rejects.toThrow("Usage:")
  })
})
