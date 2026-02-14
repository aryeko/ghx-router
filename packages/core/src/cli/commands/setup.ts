import { mkdir, readFile, stat, copyFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

import { MAIN_SKILL_TEXT } from "../../agent-interface/prompt/main-skill.js"

type SetupPlatform = "claude-code" | "opencode"
type SetupScope = "user" | "project"

type SetupOptions = {
  platform: SetupPlatform
  scope: SetupScope
  profile: "pr-review-ci"
  dryRun: boolean
  verify: boolean
  yes: boolean
}

export type SetupCommandDeps = {
  cwd: string
  homeDir: string
  nowMs: () => number
}

const DEFAULT_DEPS: SetupCommandDeps = {
  cwd: process.cwd(),
  homeDir: homedir(),
  nowMs: () => Date.now()
}

function usage(): string {
  return "Usage:\n  ghx setup --platform <claude-code|opencode> --scope <user|project> [--profile pr-review-ci] [--dry-run] [--verify] [--yes]"
}

function parseSetupArgs(argv: string[]): SetupOptions {
  let platform: SetupPlatform | undefined
  let scope: SetupScope | undefined
  let profile = "pr-review-ci" as const
  let dryRun = false
  let verify = false
  let yes = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--dry-run") {
      dryRun = true
      continue
    }
    if (arg === "--verify") {
      verify = true
      continue
    }
    if (arg === "--yes") {
      yes = true
      continue
    }
    if (arg === "--platform") {
      const value = argv[index + 1]
      if (value === "claude-code" || value === "opencode") {
        platform = value
        index += 1
        continue
      }
      throw new Error("Invalid --platform value. Expected claude-code or opencode")
    }
    if (arg === "--scope") {
      const value = argv[index + 1]
      if (value === "user" || value === "project") {
        scope = value
        index += 1
        continue
      }
      throw new Error("Invalid --scope value. Expected user or project")
    }
    if (arg === "--profile") {
      const value = argv[index + 1]
      if (value === "pr-review-ci") {
        profile = value
        index += 1
        continue
      }
      throw new Error("Invalid --profile value. Expected pr-review-ci")
    }

    throw new Error(`Unknown setup argument: ${arg}`)
  }

  if (!platform || !scope) {
    throw new Error(usage())
  }

  if (dryRun && verify) {
    throw new Error("--dry-run and --verify cannot be used together")
  }

  return { platform, scope, profile, dryRun, verify, yes }
}

function resolveSkillPath(options: Pick<SetupOptions, "platform" | "scope">, deps: SetupCommandDeps): string {
  if (options.platform === "claude-code") {
    const root = options.scope === "user" ? deps.homeDir : deps.cwd
    return join(root, ".claude", "skills", "ghx", "SKILL.md")
  }

  if (options.scope === "user") {
    return join(deps.homeDir, ".config", "opencode", "skills", "ghx", "SKILL.md")
  }

  return join(deps.cwd, ".opencode", "skills", "ghx", "SKILL.md")
}

function buildSkillContent(profile: SetupOptions["profile"]): string {
  return [
    "---",
    "name: ghx",
    "description: Stable GitHub capability execution with ghx",
    `profile: ${profile}`,
    "---",
    "",
    "# ghx",
    "",
    MAIN_SKILL_TEXT,
    ""
  ].join("\n")
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function verifySetup(skillPath: string): Promise<{ ok: boolean; message: string }> {
  const exists = await pathExists(skillPath)
  if (!exists) {
    return { ok: false, message: `VERIFY FAIL: missing ${skillPath}` }
  }

  const content = await readFile(skillPath, "utf8")
  const requiredMarkers = ["name: ghx", "profile: pr-review-ci", "# ghx", "Use execute(capability_id, params)"]
  const missingMarkers = requiredMarkers.filter((marker) => !content.includes(marker))
  if (missingMarkers.length > 0) {
    return {
      ok: false,
      message: `VERIFY FAIL: invalid ghx skill content in ${skillPath} (missing: ${missingMarkers.join(", ")})`
    }
  }

  return { ok: true, message: `VERIFY PASS: ${skillPath}` }
}

export async function setupCommand(argv: string[] = [], deps: SetupCommandDeps = DEFAULT_DEPS): Promise<number> {
  const options = parseSetupArgs(argv)
  const skillPath = resolveSkillPath(options, deps)
  const skillContent = buildSkillContent(options.profile)

  if (options.verify) {
    const result = await verifySetup(skillPath)
    process.stdout.write(`${result.message}\n`)
    return result.ok ? 0 : 1
  }

  if (options.dryRun) {
    process.stdout.write(`DRY RUN: install profile ${options.profile} to ${skillPath}\n`)
    return 0
  }

  const exists = await pathExists(skillPath)
  if (exists) {
    const current = await readFile(skillPath, "utf8")
    if (current === skillContent) {
      process.stdout.write("Already configured: no changes required\n")
      return 0
    }

    if (!options.yes) {
      throw new Error(`Refusing to overwrite existing setup at ${skillPath}. Re-run with --yes to allow overwrite.`)
    }

    const backupPath = `${skillPath}.bak.${deps.nowMs()}`
    await copyFile(skillPath, backupPath)
    process.stdout.write(`Created backup: ${backupPath}\n`)
  }

  await mkdir(dirname(skillPath), { recursive: true })
  await writeFile(skillPath, skillContent, "utf8")
  process.stdout.write(`Configured ghx setup at ${skillPath}\n`)
  return 0
}
