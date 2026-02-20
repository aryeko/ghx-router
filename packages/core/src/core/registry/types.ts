import type { RouteSource } from "../contracts/envelope.js"

export type JsonSchema = Record<string, unknown>

export interface SuitabilityRule {
  when: "always" | "env" | "params"
  predicate: string
  reason: string
}

export interface OperationCard<Input = Record<string, unknown>> {
  capability_id: string
  version: string
  description: string
  input_schema: JsonSchema
  output_schema: JsonSchema
  routing: {
    preferred: RouteSource
    fallbacks: RouteSource[]
    suitability?: SuitabilityRule[]
    notes?: string[]
  }
  graphql?: {
    operationName: string
    documentPath: string
    variables?: Record<string, string>
    limits?: { maxPageSize?: number }
  }
  cli?: {
    command: string
    jsonFields?: string[]
    jq?: string
    limits?: { maxItemsPerCall?: number }
  }
  rest?: {
    endpoints: Array<{ method: string; path: string }>
  }
  examples?: Array<{
    title: string
    input: Input
  }>
}
