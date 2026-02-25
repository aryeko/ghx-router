import type { CapabilityListItem } from "@core/core/registry/list-capabilities.js"
import { listCapabilities } from "@core/core/registry/list-capabilities.js"
import { extractArrayItemHints } from "@core/core/registry/schema-utils.js"

function parseArgs(argv: string[]): {
  asJson: boolean
  asCompact: boolean
  domain: string | undefined
} {
  const domainIndex = argv.indexOf("--domain")
  return {
    asJson: argv.includes("--json"),
    asCompact: argv.includes("--compact"),
    domain: domainIndex !== -1 ? argv[domainIndex + 1] : undefined,
  }
}

function formatCompact(capabilities: CapabilityListItem[]): string {
  const ids = new Set(capabilities.map((c) => c.capability_id))

  const lines = capabilities.map((item) => {
    const req = item.required_inputs.join(",")
    const opt = item.optional_inputs.map((o) => `${o}?`).join(",")
    const inputs = [req, opt].filter(Boolean).join(",")
    const sig = `${item.capability_id}(${inputs})`

    const addSibling = item.capability_id.replace(/\.set$/, ".add")
    const needsWarning = item.capability_id.endsWith(".set") && ids.has(addSibling)
    return needsWarning ? `${sig} [replaces all]` : sig
  })

  return lines.join("\n") + "\n"
}

export async function capabilitiesListCommand(argv: string[] = []): Promise<number> {
  const { asJson, asCompact, domain } = parseArgs(argv)
  const capabilities = listCapabilities(domain)

  if (capabilities.length === 0) {
    process.stderr.write(
      domain ? `No capabilities found for domain: ${domain}\n` : "No capabilities found\n",
    )
    return 1
  }

  if (asCompact) {
    process.stdout.write(formatCompact(capabilities))
    return 0
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
    const required = item.required_inputs.join(", ")
    const arrayHints = extractArrayItemHints({ properties: item.optional_inputs_detail })
    const optional = item.optional_inputs
      .map((n) => {
        const hints = arrayHints[n]
        return hints ? `${n}?[${hints.join(", ")}]` : `${n}?`
      })
      .join(", ")
    const inputs = optional.length > 0 ? `[${required}, ${optional}]` : `[${required}]`
    return `${id} - ${desc} ${inputs}`
  })
  process.stdout.write(`${lines.join("\n")}\n`)
  return 0
}
