import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

type CommandResult = {
  status: number
  stdout: string
  stderr: string
}

function run(command: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  })

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

function runOrThrow(command: string, args: string[], cwd: string): CommandResult {
  const result = run(command, args, cwd)
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        `cwd: ${cwd}`,
        result.stdout,
        result.stderr,
      ].join("\n"),
    )
  }

  return result
}

describe("ghx setup e2e install/verify", () => {
  it("installs package, fails verify pre-install, then passes verify post-install", () => {
    const workspacePath = fileURLToPath(new URL("../../../../", import.meta.url))
    const tempRoot = mkdtempSync(join(tmpdir(), "ghx-e2e-install-"))
    const packDir = join(tempRoot, "pack")
    const projectDir = join(tempRoot, "project")
    const isolatedXdgConfig = mkdtempSync(join(tmpdir(), "ghx-e2e-install-xdg-"))
    const originalXdg = process.env.XDG_CONFIG_HOME

    process.env.XDG_CONFIG_HOME = isolatedXdgConfig

    try {
      runOrThrow("mkdir", ["-p", packDir, projectDir], workspacePath)
      writeFileSync(
        join(projectDir, "package.json"),
        JSON.stringify({ name: "ghx-e2e-project", private: true, version: "0.0.0" }, null, 2),
        "utf8",
      )

      runOrThrow("pnpm", ["--filter", "@ghx-dev/core", "run", "build"], workspacePath)
      const packResult = runOrThrow(
        "pnpm",
        ["--filter", "@ghx-dev/core", "pack", "--pack-destination", packDir],
        workspacePath,
      )
      const tarballName = packResult.stdout
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.endsWith(".tgz"))

      expect(tarballName).toBeDefined()
      const tarballPath = (tarballName as string).startsWith("/")
        ? (tarballName as string)
        : join(packDir, tarballName as string)

      runOrThrow("pnpm", ["add", tarballPath], projectDir)

      const verifyBefore = run(
        "pnpm",
        ["exec", "ghx", "setup", "--scope", "project", "--verify"],
        projectDir,
      )
      expect(verifyBefore.status).toBe(1)
      expect(verifyBefore.stderr).toContain("Verify failed")

      const setup = run("pnpm", ["exec", "ghx", "setup", "--scope", "project", "--yes"], projectDir)
      expect(setup.status).toBe(0)
      expect(setup.stdout).toContain("Setup complete")

      const skillPath = join(projectDir, ".agents", "skills", "ghx", "SKILL.md")
      const skillContent = readFileSync(skillPath, "utf8")
      expect(skillContent).toContain("## Session Bootstrap (run once)")

      const verifyAfter = run(
        "pnpm",
        ["exec", "ghx", "setup", "--scope", "project", "--verify"],
        projectDir,
      )
      expect(verifyAfter.status).toBe(0)
      expect(verifyAfter.stdout).toContain("Verify passed")
    } finally {
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg
      }
    }
  })
})
