import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { z } from "zod"

const gateProfileSchema = z.enum(["verify_pr", "verify_release"])

const parsedArgsSchema = z.object({
  outPath: z.string().trim().min(1, "--out must be a non-empty path"),
  scenarioSet: z.string().trim().min(1, "--scenario-set must be a non-empty value"),
  repetitions: z
    .number()
    .int({ message: "Invalid --repetitions value" })
    .positive({ message: "Invalid --repetitions value" }),
  gateProfile: gateProfileSchema,
  includeCleanup: z.boolean(),
  includeSeed: z.boolean(),
  includeGate: z.boolean(),
})

type ParsedArgs = {
  outPath: string
  scenarioSet: string
  repetitions: number
  gateProfile: z.infer<typeof gateProfileSchema>
  includeCleanup: boolean
  includeSeed: boolean
  includeGate: boolean
}

function parseFlagValue(args: string[], flag: string): string | null {
  const index = args.findIndex((arg) => arg === flag)
  if (index !== -1) {
    const value = args[index + 1]
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`)
    }

    return value
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`))
  if (inline) {
    return inline.slice(flag.length + 1)
  }

  return null
}

export function parseArgs(argv: string[]): ParsedArgs {
  const normalized = argv.filter((arg) => arg !== "--")

  const outPath = parseFlagValue(normalized, "--out") ?? "config/suite-runner.json"
  const scenarioSet = parseFlagValue(normalized, "--scenario-set") ?? "ci-verify-pr"

  const repetitionsRaw = parseFlagValue(normalized, "--repetitions") ?? "3"
  const repetitions = Number.parseInt(repetitionsRaw, 10)
  if (!Number.isFinite(repetitions)) {
    throw new Error(`Invalid --repetitions value: ${repetitionsRaw}`)
  }

  const gateProfileRaw = parseFlagValue(normalized, "--gate-profile") ?? "verify_pr"
  const gateProfile = gateProfileSchema.parse(gateProfileRaw)

  const includeCleanup =
    normalized.includes("--with-cleanup") && !normalized.includes("--skip-cleanup")
  const includeSeed = normalized.includes("--with-seed") && !normalized.includes("--skip-seed")
  const includeGate = !normalized.includes("--no-gate")

  return parsedArgsSchema.parse({
    outPath,
    scenarioSet,
    repetitions,
    gateProfile,
    includeCleanup,
    includeSeed,
    includeGate,
  })
}

export function buildConfig(args: ParsedArgs): Record<string, unknown> {
  return {
    fixtures: {
      setup: {
        ...(args.includeCleanup
          ? {
              cleanup: {
                command: ["rm", "-f", "reports/latest-summary.json", "reports/latest-summary.md"],
              },
            }
          : {}),
        ...(args.includeSeed
          ? {
              seed: {
                command: ["pnpm", "run", "fixtures", "--", "seed"],
              },
            }
          : {}),
      },
    },
    benchmark: {
      base: {
        command: ["pnpm", "run", "benchmark", "--"],
        repetitions: args.repetitions,
        scenarioSet: args.scenarioSet,
      },
      ghx: {
        mode: "ghx",
        env: {
          GHX_SKIP_GH_PREFLIGHT: "1",
          BENCH_OPENCODE_PORT: "3001",
        },
      },
      direct: {
        mode: "agent_direct",
        env: {
          BENCH_OPENCODE_PORT: "3002",
        },
      },
    },
    reporting: {
      analysis: {
        report: {
          command: ["pnpm", "run", "report"],
        },
        ...(args.includeGate
          ? {
              gate: {
                command: [
                  "pnpm",
                  "run",
                  "report",
                  "--",
                  "--gate",
                  "--gate-profile",
                  args.gateProfile,
                ],
              },
            }
          : {}),
      },
    },
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv)
  const outPath = resolve(parsed.outPath)
  const config = buildConfig(parsed)

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
  console.log(`Wrote ${outPath}`)
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
  })
}
