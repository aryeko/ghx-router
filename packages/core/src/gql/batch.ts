import type { GraphqlVariables } from "./transport.js"

export type BatchOperationInput = {
  alias: string
  mutation: string
  variables: GraphqlVariables
}

export type BatchMutationResult = {
  document: string
  variables: GraphqlVariables
}

export function buildBatchMutation(operations: BatchOperationInput[]): BatchMutationResult {
  if (operations.length === 0) {
    throw new Error("buildBatchMutation requires at least one operation")
  }

  const allVarDeclarations: string[] = []
  const allSelections: string[] = []
  const mergedVariables: GraphqlVariables = {}

  for (const op of operations) {
    const parsed = parseMutation(op.mutation)

    // Prefix variable declarations
    for (const varDecl of parsed.variableDeclarations) {
      allVarDeclarations.push(`$${op.alias}_${varDecl.name}: ${varDecl.type}`)
    }

    // Prefix variable references in body and add alias
    let body = parsed.body
    const sortedDeclarations = [...parsed.variableDeclarations].sort(
      (a, b) => b.name.length - a.name.length,
    )
    for (const varDecl of sortedDeclarations) {
      body = body.replaceAll(
        new RegExp(`\\$${escapeRegex(varDecl.name)}\\b`, "g"),
        `$${op.alias}_${varDecl.name}`,
      )
    }

    // Add alias prefix to the top-level field
    const aliasedBody = body.replace(/^\s*(\w+)/, `${op.alias}: $1`)
    allSelections.push(aliasedBody)

    // Prefix variable values
    for (const [key, value] of Object.entries(op.variables)) {
      mergedVariables[`${op.alias}_${key}`] = value
    }
  }

  const document = `mutation BatchComposite(${allVarDeclarations.join(", ")}) {\n${allSelections.join("\n")}\n}`

  return { document, variables: mergedVariables }
}

type VariableDeclaration = { name: string; type: string }
type ParsedMutation = { variableDeclarations: VariableDeclaration[]; body: string }

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function parseMutation(mutation: string): ParsedMutation {
  // Extract variable declarations from header: mutation Name($var1: Type!, $var2: Type!)
  const headerMatch = mutation.match(/mutation\s+\w+\s*\(([^)]*)\)/)
  const variableDeclarations: VariableDeclaration[] = []

  if (headerMatch && headerMatch[1]) {
    const varString = headerMatch[1]
    const varMatches = varString.matchAll(/\$(\w+)\s*:\s*([^,)]+)/g)
    for (const match of varMatches) {
      const name = match[1]
      const type = match[2]
      if (name && type) {
        variableDeclarations.push({
          name,
          type: type.trim(),
        })
      }
    }
  }

  // Extract body: everything between the outermost { } after the header
  const headerEnd = mutation.indexOf("{")
  if (headerEnd === -1) {
    throw new Error("Invalid mutation: no opening brace found")
  }

  let depth = 0
  let bodyStart = -1
  let bodyEnd = -1
  for (let i = headerEnd; i < mutation.length; i++) {
    if (mutation[i] === "{") {
      if (depth === 0) bodyStart = i + 1
      depth++
    } else if (mutation[i] === "}") {
      depth--
      if (depth === 0) {
        bodyEnd = i
        break
      }
    }
  }

  if (bodyStart === -1 || bodyEnd === -1) {
    throw new Error("Invalid mutation: unbalanced braces")
  }

  const body = mutation.slice(bodyStart, bodyEnd).trim()
  return { variableDeclarations, body }
}
