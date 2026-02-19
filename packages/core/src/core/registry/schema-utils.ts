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
