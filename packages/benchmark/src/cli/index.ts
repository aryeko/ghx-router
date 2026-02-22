async function main(): Promise<void> {
  const command = process.argv[2]

  switch (command) {
    case "run":
      await import("./run-command.js")
      break
    case "fixture":
      await import("./fixture-command.js")
      break
    case "report":
      await import("./report-command.js")
      break
    case "check":
      await import("./check-command.js")
      break
    default:
      console.error(`Unknown command: ${command}`)
      process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
