import { explainCapability } from "../../agent-interface/tools/explain-tool.js"
import { listCapabilities } from "../../agent-interface/tools/list-capabilities-tool.js"
import { formatJson } from "../formatters/json.js"

function usage(): string {
  return "Usage:\n  ghx capabilities list\n  ghx capabilities explain <capability_id>"
}

export async function capabilitiesCommand(argv: string[] = []): Promise<number> {
  const [subcommand, capabilityId] = argv

  if (subcommand === "list") {
    process.stdout.write(`${formatJson(listCapabilities())}\n`)
    return 0
  }

  if (subcommand === "explain") {
    if (!capabilityId || capabilityId.trim().length === 0) {
      process.stderr.write(`${usage()}\n`)
      return 1
    }

    process.stdout.write(`${formatJson(explainCapability(capabilityId))}\n`)
    return 0
  }

  process.stderr.write(`${usage()}\n`)
  return 1
}
