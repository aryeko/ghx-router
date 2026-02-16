import { access, appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import readline from "node:readline/promises"
import { fileURLToPath } from "node:url"

import { Ajv } from "ajv"
import type { ErrorCode } from "../../core/errors/codes.js"
import { errorCodes } from "../../core/errors/codes.js"

type SetupScope = "user" | "project"

type SetupOptions = {
  scope: SetupScope
  assumeYes: boolean
  dryRun: boolean
  verifyOnly: boolean
  track: boolean
}

type SetupError = Error & { code?: ErrorCode }

const ajv = new Ajv({ allErrors: true, strict: false })

const setupOptionsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["scope", "assumeYes", "dryRun", "verifyOnly", "track"],
  properties: {
    scope: {
      type: "string",
      enum: ["user", "project"],
    },
    assumeYes: { type: "boolean" },
    dryRun: { type: "boolean" },
    verifyOnly: { type: "boolean" },
    track: { type: "boolean" },
  },
} as const

const validateSetupOptions = ajv.compile(setupOptionsSchema)

const setupCommandDirectory = dirname(fileURLToPath(import.meta.url))
const setupSkillAssetPathCandidates = [
  join(setupCommandDirectory, "..", "assets", "skills", "ghx", "SKILL.md"),
  join(setupCommandDirectory, "assets", "skills", "ghx", "SKILL.md"),
  join(setupCommandDirectory, "cli", "assets", "skills", "ghx", "SKILL.md"),
]

function isENOENT(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  )
}

function createSetupError(message: string, code: ErrorCode): SetupError {
  const error = new Error(message) as SetupError
  error.code = code
  return error
}

async function loadSetupSkillContent(): Promise<string> {
  for (const candidatePath of setupSkillAssetPathCandidates) {
    try {
      return await readFile(candidatePath, "utf8")
    } catch (error) {
      if (isENOENT(error)) {
        continue
      }

      throw error
    }
  }

  throw createSetupError(
    `Setup skill asset not found. Checked: ${setupSkillAssetPathCandidates.join(", ")}`,
    errorCodes.NotFound,
  )
}

function usage(): string {
  return "Usage: ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]"
}

function parseScope(argv: string[]): SetupScope | undefined {
  const inline = argv.find((arg) => arg.startsWith("--scope="))
  if (inline) {
    const raw = inline.slice("--scope=".length)
    if (raw === "user" || raw === "project") {
      return raw
    }
    return undefined
  }

  const scopeIndex = argv.findIndex((arg) => arg === "--scope")
  if (scopeIndex < 0) {
    return undefined
  }

  const value = argv[scopeIndex + 1]
  if (value === "user" || value === "project") {
    return value
  }

  return undefined
}

function parseArgs(argv: string[]): SetupOptions | null {
  const scope = parseScope(argv)
  if (!scope) {
    return null
  }

  const options: SetupOptions = {
    scope,
    assumeYes: argv.includes("--yes"),
    dryRun: argv.includes("--dry-run"),
    verifyOnly: argv.includes("--verify"),
    track: argv.includes("--track"),
  }

  if (!validateSetupOptions(options)) {
    return null
  }

  return options
}

function resolveSkillPath(scope: SetupScope): string {
  const base = scope === "user" ? homedir() : process.cwd()
  return join(base, ".agents", "skills", "ghx", "SKILL.md")
}

function resolveTrackingPath(): string {
  return join(homedir(), ".agents", "ghx", "setup-events.jsonl")
}

async function writeTrackingEvent(options: {
  track: boolean
  scope: SetupScope
  mode: "apply"
  success: boolean
}): Promise<void> {
  if (!options.track) {
    return
  }

  const trackingPath = resolveTrackingPath()
  await mkdir(join(homedir(), ".agents", "ghx"), { recursive: true })
  await appendFile(
    trackingPath,
    `${JSON.stringify({
      command: "setup",
      scope: options.scope,
      mode: options.mode,
      success: options.success,
      timestamp: new Date().toISOString(),
    })}\n`,
    "utf8",
  )
}

async function confirmOverwrite(skillPath: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question(`Skill already exists at ${skillPath}. Overwrite? [y/N] `)
    const normalized = answer.trim().toLowerCase()
    return normalized === "y" || normalized === "yes"
  } finally {
    rl.close()
  }
}

async function verifySkill(skillPath: string): Promise<boolean> {
  try {
    const content = await readFile(skillPath, "utf8")
    return content.includes("ghx capabilities")
  } catch (error) {
    if (isENOENT(error)) {
      return false
    }

    throw error
  }
}

async function skillFileExists(skillPath: string): Promise<boolean> {
  try {
    await access(skillPath)
    return true
  } catch (error) {
    if (isENOENT(error)) {
      return false
    }

    throw error
  }
}

export async function setupCommand(argv: string[] = []): Promise<number> {
  const parsed = parseArgs(argv)
  if (!parsed) {
    process.stderr.write(`${usage()}\n`)
    return 1
  }

  const skillPath = resolveSkillPath(parsed.scope)

  try {
    if (parsed.verifyOnly) {
      const ok = await verifySkill(skillPath)
      if (!ok) {
        process.stderr.write(`Verify failed: skill not installed at ${skillPath}\n`)
        return 1
      }

      process.stdout.write(`Verify passed: skill installed at ${skillPath}\n`)
      return 0
    }

    if (parsed.dryRun) {
      process.stdout.write(`Dry run: would write ${skillPath}\n`)
      return 0
    }

    const alreadyExists = await skillFileExists(skillPath)
    if (alreadyExists && !parsed.assumeYes) {
      const approved = await confirmOverwrite(skillPath)
      if (!approved) {
        process.stderr.write(
          `Skill already exists at ${skillPath}. Re-run with --yes or confirm overwrite interactively.\n`,
        )
        await writeTrackingEvent({
          track: parsed.track,
          scope: parsed.scope,
          mode: "apply",
          success: false,
        })
        return 1
      }
    }

    const skillContent = await loadSetupSkillContent()
    await mkdir(dirname(skillPath), { recursive: true })
    await writeFile(skillPath, skillContent, "utf8")

    process.stdout.write(`Setup complete: wrote ${skillPath}\n`)
    process.stdout.write("Try: ghx capabilities list\n")
    await writeTrackingEvent({
      track: parsed.track,
      scope: parsed.scope,
      mode: "apply",
      success: true,
    })
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Setup failed: ${message}\n`)
    return 1
  }
}
