import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { setupCommand } from "@core/cli/commands/setup.js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("setupCommand", () => {
  const originalHome = process.env.HOME
  const originalCwd = process.cwd()

  let tempRoot = ""

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "ghx-setup-test-"))
    process.env.HOME = tempRoot
  })

  afterEach(() => {
    process.env.HOME = originalHome
    process.chdir(originalCwd)
    vi.restoreAllMocks()
  })

  it("prints usage and exits when scope is missing", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await setupCommand([])

    expect(code).toBe(1)
    expect(stderr).toHaveBeenCalledWith(
      "Usage: ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]\n",
    )
  })

  it("supports dry-run without writing files", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user", "--dry-run"])

    expect(code).toBe(0)
    expect(stdout.mock.calls.map((call) => String(call[0])).join("")).toContain("Dry run")
    expect(stdout.mock.calls.map((call) => String(call[0])).join("")).toContain(
      ".agents/skills/ghx/SKILL.md",
    )
  })

  it("supports inline scope format", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope=user", "--dry-run"])

    expect(code).toBe(0)
    expect(stdout.mock.calls.map((call) => String(call[0])).join("")).toContain("Dry run")
  })

  it("prints usage for invalid inline scope", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope=invalid"])

    expect(code).toBe(1)
    expect(stderr).toHaveBeenCalledWith(
      "Usage: ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]\n",
    )
  })

  it("writes skill file for user scope", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user", "--yes"])

    expect(code).toBe(0)
    const skillPath = join(tempRoot, ".agents", "skills", "ghx", "SKILL.md")
    const content = readFileSync(skillPath, "utf8")
    expect(content).toContain("Use `ghx run` for ALL GitHub operations.")
    expect(content).toContain("ghx capabilities list --domain pr")
    expect(content).toContain("ghx run <capability_id> --input - <<'EOF'")
    expect(content).not.toContain("GHX_SKIP_GH_PREFLIGHT=1")
    expect(stdout.mock.calls.map((call) => String(call[0])).join("")).toContain("Setup complete")
  })

  it("writes skill file for project scope", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "ghx-project-"))
    process.chdir(projectRoot)
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "project", "--yes"])

    expect(code).toBe(0)
    const skillPath = join(projectRoot, ".agents", "skills", "ghx", "SKILL.md")
    const content = readFileSync(skillPath, "utf8")
    expect(content).toContain("ghx capabilities list")
    expect(content).not.toContain("GHX_SKIP_GH_PREFLIGHT=1")
    expect(stdout.mock.calls.map((call) => String(call[0])).join("")).toContain("Setup complete")
  })

  it("verify succeeds when skill is installed", async () => {
    await setupCommand(["--scope", "user", "--yes"])
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user", "--verify"])

    expect(code).toBe(0)
    expect(stdout.mock.calls.map((call) => String(call[0])).join("")).toContain("Verify passed")
  })

  it("verify fails when skill is missing", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user", "--verify"])

    expect(code).toBe(1)
    expect(stderr.mock.calls.map((call) => String(call[0])).join("")).toContain("not installed")
  })

  it("requires overwrite confirmation when skill exists and --yes is not provided", async () => {
    const skillPath = join(tempRoot, ".agents", "skills", "ghx", "SKILL.md")
    const projectDir = join(tempRoot, ".agents", "skills", "ghx")
    await setupCommand(["--scope", "user", "--yes"])
    writeFileSync(skillPath, "custom content", "utf8")

    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user"])

    expect(code).toBe(1)
    expect(stderr.mock.calls.map((call) => String(call[0])).join("")).toContain("already exists")
    expect(readFileSync(join(projectDir, "SKILL.md"), "utf8")).toBe("custom content")
  })

  it("writes setup tracking event only for apply mode when --track is provided", async () => {
    const trackingFile = join(tempRoot, ".agents", "ghx", "setup-events.jsonl")

    await setupCommand(["--scope", "user", "--yes"])

    const noTrackVerify = await setupCommand(["--scope", "user", "--verify"])
    expect(noTrackVerify).toBe(0)

    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
    await expect(async () => readFileSync(trackingFile, "utf8")).rejects.toThrow()
    expect(stderr).not.toHaveBeenCalled()

    await setupCommand(["--scope", "user", "--yes", "--track"])
    const tracked = readFileSync(trackingFile, "utf8")
    expect(tracked).toContain('"command":"setup"')
    expect(tracked).toContain('"mode":"apply"')
    expect(tracked).toContain('"success":true')
  })

  it("does not write tracking in dry-run or verify even when --track is set", async () => {
    const trackingFile = join(tempRoot, ".agents", "ghx", "setup-events.jsonl")

    const dryRunCode = await setupCommand(["--scope", "user", "--dry-run", "--track"])
    expect(dryRunCode).toBe(0)

    const verifyCode = await setupCommand(["--scope", "user", "--verify", "--track"])
    expect(verifyCode).toBe(1)

    await expect(async () => readFileSync(trackingFile, "utf8")).rejects.toThrow()
  })
})
