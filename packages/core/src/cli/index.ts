#!/usr/bin/env node

import { realpathSync } from "node:fs"
import { pathToFileURL } from "node:url"

import { capabilitiesExplainCommand } from "./commands/capabilities-explain.js"
import { capabilitiesListCommand } from "./commands/capabilities-list.js"
import { runCommand } from "./commands/run.js"
import { setupCommand } from "./commands/setup.js"

function usage(): string {
  return [
    "Usage:",
    "  ghx run <task> --input '<json>' | --input - [--check-gh-preflight]",
    "  ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]",
    "  ghx capabilities list",
    "  ghx capabilities explain <capability_id>",
  ].join("\n")
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const [command, ...rest] = argv

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(`${usage()}\n`)
    return 0
  }

  if (command === "run") {
    return runCommand(rest)
  }

  if (command === "setup") {
    return setupCommand(rest)
  }

  if (command === "capabilities") {
    const [subcommand, ...subcommandArgs] = rest

    if (!subcommand) {
      process.stderr.write(`Missing capabilities subcommand.\n${usage()}\n`)
      return 1
    }

    if (subcommand === "list") {
      return capabilitiesListCommand(subcommandArgs)
    }

    if (subcommand === "explain") {
      return capabilitiesExplainCommand(subcommandArgs)
    }

    process.stderr.write(`Unknown capabilities subcommand: ${subcommand}\n${usage()}\n`)
    return 1
  }

  process.stderr.write(`Unknown command: ${command}\n${usage()}\n`)
  return 1
}

const isDirectRun = (() => {
  if (!process.argv[1]) {
    return false
  }

  try {
    const currentEntry = realpathSync(new URL(import.meta.url))
    const invokedEntry = realpathSync(process.argv[1])
    return currentEntry === invokedEntry || import.meta.url === pathToFileURL(process.argv[1]).href
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1]).href
  }
})()

if (isDirectRun) {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`${message}\n`)
      process.exit(1)
    },
  )
}
