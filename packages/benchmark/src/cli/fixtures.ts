import { access, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { z } from "zod"
import { applyFixtureAppAuthIfConfigured, mintFixtureAppToken } from "../fixture/app-auth.js"
import { cleanupAllFixtures, cleanupSeededFixtures } from "../fixture/cleanup.js"
import { loadFixtureManifest } from "../fixture/manifest.js"
import { seedFixtureManifest } from "../fixture/seed.js"
import { runIfDirectEntry } from "./entry.js"
import { parseFlagValue } from "./flag-utils.js"

type FixtureCommand = "seed" | "status" | "cleanup"

type ParsedFixtureArgs = {
  command: FixtureCommand
  repo: string
  outFile: string
  seedId: string
  all: boolean
}

const fixtureCommandSchema = z.enum(["seed", "status", "cleanup"])
const fixtureRepoSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
const fixtureOutFileSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine((value) => !value.includes("\0"))
const fixtureSeedIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)

function parseCliValue<T>(schema: z.ZodSchema<T>, value: string, label: string): T {
  const parsed = schema.safeParse(value)
  if (parsed.success) {
    return parsed.data
  }

  const issue = parsed.error.issues[0]
  const detail = issue?.message ? `: ${issue.message}` : ""
  throw new Error(`Invalid ${label} value${detail}`)
}

export function parseArgs(argv: string[]): ParsedFixtureArgs {
  const normalized = argv.filter((arg) => arg !== "--")
  const [commandRaw = "status"] = normalized

  const commandResult = fixtureCommandSchema.safeParse(commandRaw)
  if (!commandResult.success) {
    throw new Error(`Unsupported fixtures command: ${commandRaw}`)
  }
  const command = commandResult.data

  const repoRaw =
    parseFlagValue(normalized, "--repo") ??
    process.env.BENCH_FIXTURE_REPO ??
    "aryeko/ghx-bench-fixtures"
  const repo = parseCliValue(fixtureRepoSchema, repoRaw, "--repo")

  const outFileRaw =
    parseFlagValue(normalized, "--out") ??
    process.env.BENCH_FIXTURE_MANIFEST ??
    "fixtures/latest.json"
  const outFile = parseCliValue(fixtureOutFileSchema, outFileRaw, "--out")

  const seedIdRaw =
    parseFlagValue(normalized, "--seed-id") ?? process.env.BENCH_FIXTURE_SEED_ID ?? "default"
  const seedId = parseCliValue(fixtureSeedIdSchema, seedIdRaw, "--seed-id")

  const all = normalized.includes("--all")
  if (all && command !== "cleanup") {
    throw new Error("--all flag is only valid with the cleanup command")
  }

  return {
    command,
    repo,
    outFile,
    seedId,
    all,
  }
}

function loadEnvLocal(): void {
  try {
    process.loadEnvFile(resolve(import.meta.dirname ?? ".", "../../.env.local"))
  } catch {
    // .env.local is optional
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  loadEnvLocal()
  const parsed = parseArgs(argv)
  const restoreFixtureAuth =
    parsed.command === "cleanup" ? await applyFixtureAppAuthIfConfigured() : () => undefined

  try {
    if (parsed.command === "seed") {
      const reviewerToken = await mintFixtureAppToken()
      const manifest = await seedFixtureManifest(
        {
          repo: parsed.repo,
          outFile: parsed.outFile,
          seedId: parsed.seedId,
        },
        reviewerToken,
      )
      console.log(`Seeded fixtures for ${manifest.repo.full_name} -> ${parsed.outFile}`)
      return
    }

    if (parsed.command === "status") {
      await access(parsed.outFile)
      const manifest = await loadFixtureManifest(parsed.outFile)
      console.log(
        `Fixture manifest OK: repo=${manifest.repo.full_name} version=${manifest.version} path=${parsed.outFile}`,
      )
      return
    }

    if (parsed.all) {
      const result = await cleanupAllFixtures(parsed.repo)
      console.log(
        `Cleaned all benchmark fixtures from ${parsed.repo}: ${result.closedIssues} issues, ${result.closedPrs} PRs, ${result.deletedBranches} branches, ${result.deletedLabels} labels, ${result.deletedProjects} projects`,
      )
      return
    }

    const manifest = await loadFixtureManifest(parsed.outFile)
    const cleanup = await cleanupSeededFixtures(manifest)
    await rm(parsed.outFile, { force: true })
    console.log(`Closed ${cleanup.closedIssues} seeded issue(s) in ${manifest.repo.full_name}`)
    console.log(`Removed fixture manifest: ${parsed.outFile}`)
  } finally {
    restoreFixtureAuth()
  }
}

runIfDirectEntry(import.meta.url, main)
