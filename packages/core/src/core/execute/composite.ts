import type { BatchOperationInput } from "../../gql/batch.js"
import { OPERATION_BUILDERS } from "../../gql/builders.js"
import type { CompositeConfig, CompositeStep } from "../registry/types.js"

export type ExpandedOperation = BatchOperationInput & {
  mapResponse: (raw: unknown) => unknown
}

/**
 * Maps action values to the capability_ids that should execute for that action.
 * Used by composites with per-item action routing (e.g., pr.threads.composite).
 */
const ACTION_TO_CAPABILITIES: Record<string, string[]> = {
  reply: ["pr.thread.reply"],
  resolve: ["pr.thread.resolve"],
  reply_and_resolve: ["pr.thread.reply", "pr.thread.resolve"],
  unresolve: ["pr.thread.unresolve"],
}

export async function expandCompositeSteps(
  composite: CompositeConfig,
  input: Record<string, unknown>,
): Promise<ExpandedOperation[]> {
  const operations: ExpandedOperation[] = []

  // Build a map of capability_id → step config for param mapping lookup
  const stepsByCapId = new Map<string, CompositeStep>()
  for (const step of composite.steps) {
    stepsByCapId.set(step.capability_id, step)
  }

  // Determine iteration: if any step has foreach, iterate over that array
  const foreachKey = composite.steps.find((s) => s.foreach)?.foreach
  const items = foreachKey ? (input[foreachKey] as Record<string, unknown>[]) : [input]

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue

    // Action-aware: if item has an `action` field, select builders by action
    const action = item.action as string | undefined
    const capabilityIds = action
      ? (ACTION_TO_CAPABILITIES[action] ?? [])
      : composite.steps.map((s) => s.capability_id)

    for (const capId of capabilityIds) {
      const builder = OPERATION_BUILDERS[capId]
      if (!builder) {
        throw new Error(`No builder registered for capability: ${capId}`)
      }
      const step = stepsByCapId.get(capId)
      if (!step) continue

      // Map item fields to builder input via params_map
      const stepInput: Record<string, unknown> = {}
      for (const [builderParam, itemField] of Object.entries(step.params_map)) {
        stepInput[builderParam] = item[itemField]
      }

      const built = await builder.build(stepInput)
      const aliasBase = capId.split(".").pop() ?? capId
      operations.push({
        alias: `${aliasBase}${i}`,
        mutation: built.mutation,
        variables: built.variables,
        mapResponse: builder.mapResponse,
      })
    }
  }

  return operations
}
