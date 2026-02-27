export async function main(argv: readonly string[]): Promise<void> {
  const command = argv[0]

  if (!command) {
    console.error("Usage: eval <run|analyze|report|check|fixture> [options]")
    process.exit(1)
  }

  switch (command) {
    case "run":
      await import("./run.js").then((m) => m.run(argv.slice(1)))
      break
    case "analyze":
      await import("./analyze.js").then((m) => m.analyze(argv.slice(1)))
      break
    case "report":
      await import("./report.js").then((m) => m.report(argv.slice(1)))
      break
    case "check":
      await import("./check.js").then((m) => m.check(argv.slice(1)))
      break
    case "fixture":
      await import("./fixture.js").then((m) => m.fixture(argv.slice(1)))
      break
    default:
      console.error(`Unknown command: ${command}`)
      console.error("Usage: eval <run|analyze|report|check|fixture> [options]")
      process.exit(1)
  }
}

// Only auto-execute when run directly (not when imported in tests)
const isDirectRun =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("index.ts") ||
    process.argv[1].endsWith("index.js") ||
    process.argv[1].includes("cli/index"))

if (isDirectRun) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
