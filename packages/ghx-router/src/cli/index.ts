#!/usr/bin/env node

import { realpathSync } from "node:fs"
import { pathToFileURL } from "node:url"

import { runCommand } from "./commands/run.js"

function usage(): string {
  return "Usage:\n  ghx run <task> --input '<json>'"
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
    }
  )
}
