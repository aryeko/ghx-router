import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { z } from "zod"
import { runIfDirectEntry } from "./entry.js"
import { parseStrictFlagValue } from "./flag-utils.js"

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

export function parseArgs(argv: string[]): ParsedArgs {
  const normalized = argv.filter((arg) => arg !== "--")

  const outPath = parseStrictFlagValue(normalized, "--out") ?? "config/suite-runner.json"
  const scenarioSet = parseStrictFlagValue(normalized, "--scenario-set") ?? "default"

  const repetitionsRaw = parseStrictFlagValue(normalized, "--repetitions") ?? "3"
  const repetitions = Number(repetitionsRaw)
  if (!Number.isFinite(repetitions) || !Number.isInteger(repetitions)) {
    throw new Error(`Invalid --repetitions value: ${repetitionsRaw}`)
  }

  const gateProfileRaw = parseStrictFlagValue(normalized, "--gate-profile") ?? "verify_pr"
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

runIfDirectEntry(import.meta.url, main)
