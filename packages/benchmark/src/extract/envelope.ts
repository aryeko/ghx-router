import type { ScenarioAssertions } from "../domain/types.js"

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function extractFirstJsonObject(input: string): unknown | null {
  const firstBrace = input.indexOf("{")
  const lastBrace = input.lastIndexOf("}")

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null
  }

  const candidate = input.slice(firstBrace, lastBrace + 1)

  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

export function validateEnvelope(assertions: ScenarioAssertions, payload: unknown): boolean {
  if (!isObject(payload)) {
    return false
  }

  const requiredFields = assertions.required_fields ?? []
  for (const field of requiredFields) {
    if (!(field in payload)) {
      return false
    }
  }

  const data = payload.data

  if (assertions.data_type === "array" && !Array.isArray(data)) {
    return false
  }

  if (assertions.data_type === "object" && !isObject(data)) {
    return false
  }

  const requiredDataFields = assertions.required_data_fields ?? []
  if (requiredDataFields.length > 0) {
    if (!isObject(data)) {
      return false
    }
    for (const field of requiredDataFields) {
      if (!(field in data)) {
        return false
      }
    }
  }

  return true
}
