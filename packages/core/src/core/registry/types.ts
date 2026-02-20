import type { RouteSource } from "../contracts/envelope.js"

export type JsonSchema = Record<string, unknown>

export interface SuitabilityRule {
  when: "always" | "env" | "params"
  predicate: string
  reason: string
}

/**
 * Extracts a single value from a Phase 1 lookup result using a dot-notation path.
 *
 * Use when the mutation needs one node ID that can be resolved via a lookup query.
 *
 * @example
 * ```yaml
 * inject:
 *   - target: pullRequestId
 *     source: scalar
 *     path: repository.pullRequest.id
 * ```
 */
export interface ScalarInject {
  target: string
  source: "scalar"
  path: string
}

/**
 * Resolves a list of human-readable names to node IDs using a Phase 1 lookup result.
 *
 * Matching is case-insensitive. Use when the mutation needs an array of IDs
 * (e.g. label IDs, assignee IDs) that must be looked up by name.
 *
 * @example
 * ```yaml
 * inject:
 *   - target: labelIds
 *     source: map_array
 *     from_input: labels           # input field containing list of names
 *     nodes_path: repository.labels.nodes
 *     match_field: name            # field on each node to match against input names
 *     extract_field: id            # field on each node to extract as the resolved value
 * ```
 */
export interface MapArrayInject {
  target: string
  source: "map_array"
  from_input: string
  nodes_path: string
  match_field: string
  extract_field: string
}

/**
 * Passes a value directly from the step's `input` into a mutation variable.
 *
 * No Phase 1 lookup is required. Use when the caller already has the required node ID
 * (e.g. the agent passes `issueId` directly), avoiding an unnecessary resolution round-trip.
 *
 * @example
 * ```yaml
 * inject:
 *   - target: labelableId
 *     source: input
 *     from_input: issueId          # the input field whose value is passed through
 * ```
 */
export interface InputPassthroughInject {
  target: string
  source: "input"
  from_input: string
}

export type InjectSpec = ScalarInject | MapArrayInject | InputPassthroughInject

export interface LookupSpec {
  operationName: string
  documentPath: string
  vars: Record<string, string>
}

export interface ResolutionConfig {
  lookup: LookupSpec
  inject: InjectSpec[]
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
    resolution?: ResolutionConfig
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
