import { pathToFileURL } from "node:url"

/**
 * Runs `main()` if the calling module is the direct CLI entry point.
 * Catches errors and exits with code 1, logging the error message.
 */
export function runIfDirectEntry(importMetaUrl: string, main: () => Promise<void>): void {
  const isDirectRun = process.argv[1]
    ? importMetaUrl === pathToFileURL(process.argv[1]).href
    : false

  if (isDirectRun) {
    main().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      console.error(message)
      process.exit(1)
    })
  }
}
