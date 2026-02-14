import type { ScenarioAssertions } from "../domain/types.js"

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function extractFirstJsonObject(input: string): unknown | null {
  const firstBrace = input.indexOf("{")
  if (firstBrace === -1) {
    return null
  }

  let depth = 0
  let inString = false
  let escaping = false

  for (let i = firstBrace; i < input.length; i += 1) {
    const ch = input[i]

    if (inString) {
      if (escaping) {
        escaping = false
        continue
      }

      if (ch === "\\") {
        escaping = true
        continue
      }

      if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === "{") {
      depth += 1
      continue
    }

    if (ch === "}") {
      depth -= 1

      if (depth === 0) {
        const candidate = input.slice(firstBrace, i + 1)
        try {
          return JSON.parse(candidate)
        } catch {
          return null
        }
      }
    }
  }

  return null
}

export function validateEnvelope(assertions: ScenarioAssertions, payload: unknown): boolean {
  if (!isObject(payload)) {
    return false
  }

  if (typeof payload.ok !== "boolean") {
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

  const meta = payload.meta
  const requiredMetaFields = assertions.required_meta_fields ?? []
  if (requiredMetaFields.length > 0) {
    if (!isObject(meta)) {
      return false
    }

    for (const field of requiredMetaFields) {
      if (!(field in meta)) {
        return false
      }
    }
  }

  if (assertions.expected_route_used !== undefined) {
    if (!isObject(meta) || meta.route_used !== assertions.expected_route_used) {
      return false
    }
  }

  if (assertions.expected_error_code !== undefined) {
    if (!isObject(payload.error) || payload.error.code !== assertions.expected_error_code) {
      return false
    }
  }

  return true
}
