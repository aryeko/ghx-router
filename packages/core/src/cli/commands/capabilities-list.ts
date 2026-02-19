import { listCapabilities } from "../../core/registry/list-capabilities.js"

function parseArgs(argv: string[]): { asJson: boolean } {
  return {
    asJson: argv.includes("--json"),
  }
}

export async function capabilitiesListCommand(argv: string[] = []): Promise<number> {
  const { asJson } = parseArgs(argv)
  const capabilities = listCapabilities()

  if (asJson) {
    process.stdout.write(`${JSON.stringify(capabilities)}\n`)
    return 0
  }

  const lines = capabilities.map((item) => `${item.capability_id} - ${item.description}`)
  process.stdout.write(`${lines.join("\n")}\n`)
  return 0
}
