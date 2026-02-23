import { resolve } from "node:path"

function loadEnvLocal(): void {
  try {
    process.loadEnvFile(resolve(import.meta.dirname ?? ".", "../../.env.local"))
  } catch {
    // .env.local is optional
  }
}

async function main(): Promise<void> {
  loadEnvLocal()

  const command = process.argv[2]

  switch (command) {
    case "run": {
      const { main } = await import("./run-command.js")
      await main(process.argv.slice(3))
      break
    }
    case "fixture": {
      const { main } = await import("./fixture-command.js")
      await main(process.argv.slice(3))
      break
    }
    case "report": {
      const { main } = await import("./report-command.js")
      await main(process.argv.slice(3))
      break
    }
    case "report:iter": {
      const { main } = await import("./report-iter-command.js")
      await main(process.argv.slice(3))
      break
    }
    case "check": {
      const { main } = await import("./check-command.js")
      await main()
      break
    }
    default:
      console.error(`Unknown command: ${command}`)
      process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
