import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { buildIterReport, formatIterReport } from "../report/iter-report.js"
import { parseFlagValue } from "./flag-utils.js"

export async function main(rawArgs: string[] = []): Promise<void> {
  const args = rawArgs.filter((a) => a !== "--")
  const ghxRunDir = args[0]
  const adRunDir = args[1]
  if (!ghxRunDir || !adRunDir) {
    throw new Error("Usage: report:iter <ghxRunDir> <adRunDir> [--output <path>]")
  }
  const outputPath = parseFlagValue(args, "--output")
  const report = await buildIterReport(ghxRunDir, adRunDir)
  const markdown = formatIterReport(report)
  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${markdown}\n`, "utf8")
    console.log(`Wrote ${outputPath}`)
  } else {
    process.stdout.write(`${markdown}\n`)
  }
}
