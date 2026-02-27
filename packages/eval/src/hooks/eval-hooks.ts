import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { FixtureManager } from "@eval/fixture/manager.js"
import type { EvalScenario } from "@eval/scenario/schema.js"
import type {
  AfterScenarioContext,
  RunContext,
  RunHooks,
  SessionTrace,
} from "@ghx-dev/agent-profiler"

/**
 * Options for {@link createEvalHooks}.
 */
export interface EvalHooksOptions {
  /** Manages GitHub fixture state (status checks and branch resets). */
  readonly fixtureManager: FixtureManager
  /** When `true`, write session trace JSON files to `reportsDir/sessions/` after each scenario. */
  readonly sessionExport: boolean
  /** Directory for session trace exports. Defaults to `"reports"`. */
  readonly reportsDir?: string
}

/**
 * Creates a `RunHooks` object that wires fixture management and session trace
 * export into the profiler run lifecycle.
 *
 * - **`beforeRun`** — asserts all required fixtures exist in the manifest;
 *   throws with a list of missing fixture names if any are absent.
 * - **`beforeScenario`** — resets fixtures to their original state when the
 *   scenario sets `fixture.reseedPerIteration = true`.
 * - **`afterScenario`** — persists the session trace to the output directory
 *   when `sessionExport` is enabled.
 *
 * @param options.fixtureManager - Manages GitHub fixture state
 * @param options.sessionExport - When `true`, write session traces to disk
 * @returns `RunHooks` object for use in `runProfileSuite`
 *
 * @example
 * ```typescript
 * import { createEvalHooks, FixtureManager } from "@ghx-dev/eval"
 *
 * const hooks = createEvalHooks({
 *   fixtureManager: new FixtureManager({
 *     repo: "owner/fixtures",
 *     manifest: "fixtures/latest.json",
 *   }),
 *   sessionExport: true,
 * })
 * ```
 */
export function createEvalHooks(options: EvalHooksOptions): RunHooks {
  return {
    beforeRun: async (_ctx: RunContext) => {
      const status = await options.fixtureManager.status()
      if (status.missing.length > 0) {
        throw new Error(
          `Missing fixtures before run: ${status.missing.join(", ")}. Run "eval fixture seed" first.`,
        )
      }
    },

    beforeScenario: async (ctx) => {
      const scenario = ctx.scenario as unknown as EvalScenario
      if (scenario.fixture?.reseedPerIteration) {
        await options.fixtureManager.reset(scenario.fixture.requires)
      }
    },

    afterScenario: async (ctx: AfterScenarioContext) => {
      if (options.sessionExport && ctx.trace) {
        await exportSessionTrace(
          ctx.trace,
          ctx.scenario.id,
          ctx.mode,
          ctx.iteration,
          options.reportsDir ?? "reports",
        )
      }
    },
  }
}

async function exportSessionTrace(
  trace: SessionTrace,
  scenarioId: string,
  mode: string,
  iteration: number,
  reportsDir: string,
): Promise<void> {
  const dir = join(reportsDir, "sessions", scenarioId)
  await mkdir(dir, { recursive: true })
  const filename = `${mode}-iter-${iteration}.json`
  await writeFile(join(dir, filename), JSON.stringify(trace, null, 2), "utf-8")
}
