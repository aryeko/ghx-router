import Ajv from "ajv"
import type { ErrorObject, ValidateFunction } from "ajv"

type SchemaValidationError = {
  instancePath: string
  message: string
  keyword: string
  params: Record<string, unknown>
}

type SchemaValidationResult =
  | { ok: true }
  | {
      ok: false
      errors: SchemaValidationError[]
    }

const ajv = new Ajv({
  allErrors: true,
  strict: false
})

const validatorCache = new WeakMap<Record<string, unknown>, ValidateFunction>()

function mapAjvErrors(errors: ErrorObject[] | null | undefined): SchemaValidationError[] {
  if (!errors) {
    return []
  }

  return errors.map((error) => ({
    instancePath: error.instancePath,
    message: error.message ?? "schema validation failed",
    keyword: error.keyword,
    params: error.params
  }))
}

function getValidator(schema: Record<string, unknown>): ValidateFunction {
  const cached = validatorCache.get(schema)
  if (cached) {
    return cached
  }

  const validator = ajv.compile(schema)
  validatorCache.set(schema, validator)
  return validator
}

function validate(schema: Record<string, unknown>, payload: unknown): SchemaValidationResult {
  const validator = getValidator(schema)
  const ok = validator(payload)

  if (ok) {
    return { ok: true }
  }

  return {
    ok: false,
    errors: mapAjvErrors(validator.errors)
  }
}

export function validateInput(inputSchema: Record<string, unknown>, params: Record<string, unknown>): SchemaValidationResult {
  return validate(inputSchema, params)
}

export function validateOutput(outputSchema: Record<string, unknown>, data: unknown): SchemaValidationResult {
  return validate(outputSchema, data)
}
