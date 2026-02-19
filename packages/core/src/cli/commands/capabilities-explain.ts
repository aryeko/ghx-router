import { explainCapability } from "@core/core/registry/explain-capability.js"

function usage(): string {
  return "Usage: ghx capabilities explain <capability_id> [--json]"
}

function parseArgs(argv: string[]): { capabilityId: string | undefined; asJson: boolean } {
  const asJson = argv.includes("--json")
  const capabilityId = argv.find((arg) => !arg.startsWith("-"))
  return { capabilityId, asJson }
}

export async function capabilitiesExplainCommand(argv: string[] = []): Promise<number> {
  const { capabilityId, asJson } = parseArgs(argv)

  if (!capabilityId) {
    process.stderr.write(`${usage()}\n`)
    return 1
  }

  try {
    const explained = explainCapability(capabilityId)

    if (asJson) {
      process.stdout.write(`${JSON.stringify(explained)}\n`)
      return 0
    }

    process.stdout.write(`${JSON.stringify(explained, null, 2)}\n`)
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    return 1
  }
}
