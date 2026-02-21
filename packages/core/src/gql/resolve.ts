import type { InjectSpec } from "@core/core/registry/types.js"
import type { GraphqlVariables } from "./transport.js"

function getAtPath(obj: unknown, path: string): unknown {
  const parts = path.split(".")
  let current = obj
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function applyInject(
  spec: InjectSpec,
  lookupResult: unknown,
  input: Record<string, unknown>,
): Record<string, unknown> {
  if (spec.source === "null_literal") {
    return { [spec.target]: null }
  }

  if (spec.source === "scalar") {
    const value = getAtPath(lookupResult, spec.path)
    if (value === undefined || value === null) {
      throw new Error(`Resolution failed for '${spec.target}': no value at path '${spec.path}'`)
    }
    return { [spec.target]: value }
  }

  if (spec.source === "input") {
    const value = input[spec.from_input]
    if (value === undefined || value === null) {
      throw new Error(
        `Resolution failed for '${spec.target}': no value at input field '${spec.from_input}'`,
      )
    }
    return { [spec.target]: value }
  }

  // map_array
  if (spec.source !== "map_array") {
    throw new Error(`Unknown inject source: '${(spec as InjectSpec).source}'`)
  }
  const nodes = getAtPath(lookupResult, spec.nodes_path)
  if (!Array.isArray(nodes)) {
    throw new Error(
      `Resolution failed for '${spec.target}': nodes at '${spec.nodes_path}' is not an array`,
    )
  }

  // Guard: if the lookup connection reported more pages, our 100-item cap may truncate results
  const pageInfoPath = spec.nodes_path.replace(/\.nodes$/, ".pageInfo.hasNextPage")
  if (getAtPath(lookupResult, pageInfoPath) === true) {
    throw new Error(
      `Resolution failed for '${spec.target}': lookup returned 100 items but more exist — request may be truncated. Narrow the scope or use a repository with fewer items.`,
    )
  }

  const idByName = new Map<string, unknown>()
  for (const node of nodes) {
    if (node && typeof node === "object") {
      const n = node as Record<string, unknown>
      const key = n[spec.match_field]
      const val = n[spec.extract_field]
      if (typeof key === "string") {
        idByName.set(key.toLowerCase(), val)
      }
    }
  }

  const inputValues = input[spec.from_input]
  if (!Array.isArray(inputValues)) {
    throw new Error(
      `Resolution failed for '${spec.target}': input field '${spec.from_input}' is not an array`,
    )
  }

  const resolved = inputValues.map((name: unknown) => {
    if (typeof name !== "string")
      throw new Error(`Resolution: expected string in '${spec.from_input}'`)
    const id = idByName.get(name.toLowerCase())
    if (id === undefined) throw new Error(`Resolution: '${name}' not found in lookup result`)
    return id
  })

  return { [spec.target]: resolved }
}

export function buildMutationVars(
  mutationDoc: string,
  input: Record<string, unknown>,
  resolved: Record<string, unknown>,
): GraphqlVariables {
  // Extract variable names declared in the mutation header
  const headerMatch = mutationDoc.match(/(?:query|mutation)\s+\w+\s*\(([^)]*)\)/)
  const mutVarNames = new Set<string>()
  if (headerMatch?.[1]) {
    for (const match of headerMatch[1].matchAll(/\$(\w+)\s*:/g)) {
      if (match[1]) mutVarNames.add(match[1])
    }
  }

  const vars: GraphqlVariables = {}
  // Pass through input fields whose names match mutation variables
  for (const varName of mutVarNames) {
    if (varName in input) {
      vars[varName] = input[varName] as GraphqlVariables[string]
    }
  }
  // Apply resolved values (may override pass-through)
  for (const [key, value] of Object.entries(resolved)) {
    if (mutVarNames.has(key)) {
      vars[key] = value as GraphqlVariables[string]
    }
  }
  return vars
}
