import { listCapabilities } from "../../core/registry/list-capabilities.js"

function parseArgs(argv: string[]): { asJson: boolean; domain: string | undefined } {
  const domainIndex = argv.indexOf("--domain")
  return {
    asJson: argv.includes("--json"),
    domain: domainIndex !== -1 ? argv[domainIndex + 1] : undefined,
  }
}

export async function capabilitiesListCommand(argv: string[] = []): Promise<number> {
  const { asJson, domain } = parseArgs(argv)
  const capabilities = listCapabilities(domain)

  if (capabilities.length === 0) {
    process.stderr.write(
      domain ? `No capabilities found for domain: ${domain}\n` : "No capabilities found\n",
    )
    return 1
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(capabilities)}\n`)
    return 0
  }

  const maxIdLen = Math.max(...capabilities.map((c) => c.capability_id.length))
  const maxDescLen = Math.max(...capabilities.map((c) => c.description.length))

  const lines = capabilities.map((item) => {
    const id = item.capability_id.padEnd(maxIdLen)
    const desc = item.description.padEnd(maxDescLen)
    const inputs = `[${item.required_inputs.join(", ")}]`
    return `${id} - ${desc} ${inputs}`
  })
  process.stdout.write(`${lines.join("\n")}\n`)
  return 0
}
