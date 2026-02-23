export function extractRequiredInputs(
  inputSchema: Record<string, unknown> | null | undefined,
): string[] {
  if (!inputSchema || typeof inputSchema !== "object") {
    return []
  }

  const required = (inputSchema as Record<string, unknown>).required
  if (!Array.isArray(required)) {
    return []
  }

  return required.filter((entry): entry is string => typeof entry === "string")
}

export function extractOptionalInputs(
  inputSchema: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!inputSchema || typeof inputSchema !== "object") return {}
  const required = new Set<string>(
    Array.isArray((inputSchema as Record<string, unknown>).required)
      ? ((inputSchema as Record<string, unknown>).required as string[])
      : [],
  )
  const properties = (inputSchema as Record<string, unknown>).properties
  if (!properties || typeof properties !== "object") return {}
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(properties as Record<string, unknown>)) {
    if (!required.has(key)) result[key] = val
  }
  return result
}

/**
 * For each array-type property in the schema, returns its item field names
 * with required fields listed first, optional fields suffixed with "?".
 * Non-array properties are omitted.
 *
 * Example output: { comments: ["path", "body", "line", "side?", "startLine?", "startSide?"] }
 */
export function extractArrayItemHints(
  inputSchema: Record<string, unknown> | null | undefined,
): Record<string, string[]> {
  if (!inputSchema || typeof inputSchema !== "object") return {}
  const properties = (inputSchema as Record<string, unknown>).properties
  if (!properties || typeof properties !== "object") return {}
  const result: Record<string, string[]> = {}
  for (const [key, val] of Object.entries(properties as Record<string, unknown>)) {
    if (!val || typeof val !== "object") continue
    const prop = val as Record<string, unknown>
    if (prop.type !== "array") continue
    const items = prop.items
    if (!items || typeof items !== "object") continue
    const itemObj = items as Record<string, unknown>
    const itemProps = itemObj.properties
    if (!itemProps || typeof itemProps !== "object") continue
    const requiredSet = new Set<string>(
      Array.isArray(itemObj.required) ? (itemObj.required as string[]) : [],
    )
    const requiredFields: string[] = []
    const optionalFields: string[] = []
    for (const fieldName of Object.keys(itemProps as Record<string, unknown>)) {
      if (requiredSet.has(fieldName)) {
        requiredFields.push(fieldName)
      } else {
        optionalFields.push(`${fieldName}?`)
      }
    }
    result[key] = [...requiredFields, ...optionalFields]
  }
  return result
}

export function extractOutputFields(
  outputSchema: Record<string, unknown> | null | undefined,
): string[] {
  if (!outputSchema || typeof outputSchema !== "object") {
    return []
  }

  const properties = (outputSchema as Record<string, unknown>).properties
  if (!properties || typeof properties !== "object") {
    return []
  }

  return Object.keys(properties)
}
