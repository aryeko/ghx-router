import type { BatchOperationInput } from "../../gql/batch.js"
import { OPERATION_BUILDERS } from "../../gql/builders.js"
import type { CompositeConfig, CompositeStep } from "../registry/types.js"

export type ExpandedOperation = BatchOperationInput & {
  mapResponse: (raw: unknown) => unknown
}

export function expandCompositeSteps(
  composite: CompositeConfig,
  input: Record<string, unknown>,
): ExpandedOperation[] {
  const operations: ExpandedOperation[] = []
  let opIndex = 0

  // Determine iteration: if any step has foreach, iterate over that array
  const foreachKey = composite.steps.find((s) => s.foreach)?.foreach
  if (foreachKey !== undefined) {
    const raw = input[foreachKey]
    if (!Array.isArray(raw)) {
      throw new Error(`Composite foreach key "${foreachKey}" must be an array, got ${typeof raw}`)
    }
  }
  const items = foreachKey ? (input[foreachKey] as Record<string, unknown>[]) : [input]

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`Composite foreach item at index ${i} must be an object`)
    }

    // Action-aware: if item has an `action` field, select steps that declare matching actions.
    const action = item.action as string | undefined
    const selectedSteps: CompositeStep[] = action
      ? composite.steps.filter((step) => step.actions?.includes(action) === true)
      : composite.steps

    if (action && selectedSteps.length === 0) {
      throw new Error(`Invalid action "${action}" for composite item at index ${i}`)
    }

    for (const step of selectedSteps) {
      if (
        step.requires_any_of &&
        step.requires_any_of.every((field) => item[field] === undefined)
      ) {
        continue
      }

      const capId = step.capability_id
      const builder = OPERATION_BUILDERS[capId]
      if (!builder) {
        throw new Error(`No builder registered for capability: ${capId}`)
      }

      // Map item fields to builder input via params_map
      const stepInput: Record<string, unknown> = {}
      for (const [builderParam, itemField] of Object.entries(step.params_map)) {
        stepInput[builderParam] = item[itemField]
      }

      const built = builder.build(stepInput)
      const aliasBase = capId.replace(/[^a-zA-Z0-9]/g, "_")
      operations.push({
        alias: `${aliasBase}_${opIndex++}`,
        mutation: built.mutation,
        variables: built.variables,
        mapResponse: builder.mapResponse,
      })
    }
  }

  return operations
}
