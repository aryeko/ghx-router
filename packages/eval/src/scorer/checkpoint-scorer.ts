import type { Checkpoint, CheckpointCondition, EvalScenario } from "@eval/scenario/schema.js"
import type {
  BaseScenario,
  Scorer,
  ScorerCheckResult,
  ScorerContext,
  ScorerResult,
} from "@ghx-dev/agent-profiler"
import type { GithubClient } from "@ghx-dev/core"
import { createGithubClientFromToken, executeTask } from "@ghx-dev/core"

/**
 * Scorer that evaluates agent output by executing ghx capability tasks against
 * live GitHub state after a session completes.
 *
 * Each checkpoint in `scenario.assertions.checkpoints` maps a ghx capability
 * task (e.g. `pr.commits.list`) and input to a condition that must hold.
 * All checkpoints must pass for `ScorerResult.success` to be `true`.
 *
 * Implements `Scorer` from `@ghx-dev/agent-profiler`.
 *
 * @param githubToken - GitHub personal access token (or `GH_TOKEN` env var)
 *
 * @example
 * ```typescript
 * import { CheckpointScorer } from "@ghx-dev/eval"
 *
 * const scorer = new CheckpointScorer(process.env.GITHUB_TOKEN!)
 * const result = await scorer.evaluate(scenario, context)
 * console.log(result.success, result.passed, "/", result.total)
 * ```
 */
export class CheckpointScorer implements Scorer {
  readonly id = "checkpoint"

  constructor(private readonly githubToken: string) {}

  async evaluate(scenario: BaseScenario, _context: ScorerContext): Promise<ScorerResult> {
    const evalScenario = scenario as unknown as EvalScenario
    const checkpoints = evalScenario.assertions.checkpoints
    const details: ScorerCheckResult[] = []
    const githubClient = createGithubClientFromToken(this.githubToken)

    for (const cp of checkpoints) {
      const checkResult = await this.evaluateCheckpoint(cp, githubClient)
      details.push(checkResult)
    }

    const passed = details.filter((d) => d.passed).length

    return {
      success: passed === details.length && details.length > 0,
      passed,
      total: details.length,
      details,
      outputValid: true,
    }
  }

  private async evaluateCheckpoint(
    cp: Checkpoint,
    githubClient: GithubClient,
  ): Promise<ScorerCheckResult> {
    try {
      const result = await executeTask(
        {
          task: cp.task,
          input: cp.input as Record<string, unknown>,
        },
        {
          githubClient,
          githubToken: this.githubToken,
          skipGhPreflight: true,
        },
      )

      if (!result.ok) {
        return {
          id: cp.id,
          description: cp.description,
          passed: false,
          error: result.error?.message ?? "Task execution failed",
        }
      }

      const passed = evaluateCondition(cp.condition, result.data)
      return {
        id: cp.id,
        description: cp.description,
        passed,
        actual: result.data,
        expected: describeCondition(cp.condition),
      }
    } catch (error) {
      return {
        id: cp.id,
        description: cp.description,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

function evaluateCondition(condition: CheckpointCondition, data: unknown): boolean {
  switch (condition.type) {
    case "non_empty":
      if (Array.isArray(data)) return data.length > 0
      return data !== null && data !== undefined
    case "empty":
      if (Array.isArray(data)) return data.length === 0
      return data === null || data === undefined
    case "count_gte":
      return Array.isArray(data) && data.length >= condition.value
    case "count_eq":
      return Array.isArray(data) && data.length === condition.value
    case "field_equals":
      return getNestedField(data, condition.path) === condition.value
    case "field_contains": {
      const fieldValue = getNestedField(data, condition.path)
      return typeof fieldValue === "string" && fieldValue.includes(condition.value)
    }
    case "custom":
      // Custom scorers not implemented in v1
      return false
  }
}

function getNestedField(obj: unknown, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function describeCondition(condition: CheckpointCondition): string {
  switch (condition.type) {
    case "non_empty":
      return "non-empty result"
    case "empty":
      return "empty result"
    case "count_gte":
      return `count >= ${condition.value}`
    case "count_eq":
      return `count == ${condition.value}`
    case "field_equals":
      return `${condition.path} == ${JSON.stringify(condition.value)}`
    case "field_contains":
      return `${condition.path} contains "${condition.value}"`
    case "custom":
      return `custom scorer: ${condition.scorer}`
  }
}
