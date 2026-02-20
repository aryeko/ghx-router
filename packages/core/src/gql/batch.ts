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

export type BatchQueryInput = {
  alias: string
  query: string
  variables: GraphqlVariables
}

export type BatchQueryResult = {
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
  const allFragments = new Map<string, string>()

  for (const op of operations) {
    const parsed = parseOperation(op.mutation)

    // Collect unique fragment definitions
    for (const [name, text] of parsed.fragments) {
      if (!allFragments.has(name)) {
        allFragments.set(name, text)
      }
    }

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

  const fragmentBlock = allFragments.size > 0 ? "\n" + [...allFragments.values()].join("\n") : ""
  const document = `mutation BatchComposite(${allVarDeclarations.join(", ")}) {\n${allSelections.join("\n")}\n}${fragmentBlock}`

  return { document, variables: mergedVariables }
}

type VariableDeclaration = { name: string; type: string }
type ParsedOperation = {
  variableDeclarations: VariableDeclaration[]
  body: string
  fragments: Map<string, string>
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function parseOperation(document: string): ParsedOperation {
  // Extract variable declarations from header: query|mutation Name($var1: Type!, $var2: Type!)
  const headerMatch = document.match(/(query|mutation)\s+\w+\s*\(([^)]*)\)/)
  const variableDeclarations: VariableDeclaration[] = []

  if (headerMatch && headerMatch[2]) {
    const varString = headerMatch[2]
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
  const headerEnd = document.indexOf("{")
  if (headerEnd === -1) {
    throw new Error("Invalid mutation: no opening brace found")
  }

  let depth = 0
  let bodyStart = -1
  let bodyEnd = -1
  for (let i = headerEnd; i < document.length; i++) {
    if (document[i] === "{") {
      if (depth === 0) bodyStart = i + 1
      depth++
    } else if (document[i] === "}") {
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

  const body = document.slice(bodyStart, bodyEnd).trim()

  // Extract fragment definitions that appear after the operation's closing brace.
  // Use brace-depth counting to correctly handle nested selections like `labels { nodes { id } }`.
  const fragments = new Map<string, string>()
  const remainder = document.slice(bodyEnd + 1)
  const fragHeaderRe = /fragment\s+(\w+)\s+on\s+\w+\s*\{/g
  let fragMatch: RegExpExecArray | null
  while ((fragMatch = fragHeaderRe.exec(remainder)) !== null) {
    const fragName = fragMatch[1]
    if (!fragName || fragments.has(fragName)) continue
    const openIdx = fragMatch.index + fragMatch[0].length - 1
    let d = 0
    let fragEnd = -1
    for (let i = openIdx; i < remainder.length; i++) {
      if (remainder[i] === "{") d++
      else if (remainder[i] === "}") {
        d--
        if (d === 0) {
          fragEnd = i
          break
        }
      }
    }
    if (fragEnd !== -1) {
      fragments.set(fragName, remainder.slice(fragMatch.index, fragEnd + 1).trim())
    }
  }

  return { variableDeclarations, body, fragments }
}

export function buildBatchQuery(operations: BatchQueryInput[]): BatchQueryResult {
  if (operations.length === 0) {
    throw new Error("buildBatchQuery requires at least one operation")
  }

  const allVarDeclarations: string[] = []
  const allSelections: string[] = []
  const mergedVariables: GraphqlVariables = {}

  for (const op of operations) {
    const parsed = parseOperation(op.query)

    for (const varDecl of parsed.variableDeclarations) {
      allVarDeclarations.push(`$${op.alias}_${varDecl.name}: ${varDecl.type}`)
    }

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

    const aliasedBody = body.replace(/^\s*(\w+)/, `${op.alias}: $1`)
    allSelections.push(aliasedBody)

    for (const [key, value] of Object.entries(op.variables)) {
      mergedVariables[`${op.alias}_${key}`] = value
    }
  }

  const varList = allVarDeclarations.length > 0 ? `(${allVarDeclarations.join(", ")})` : ""
  const document = `query BatchChain${varList} {\n${allSelections.join("\n")}\n}`

  return { document, variables: mergedVariables }
}
