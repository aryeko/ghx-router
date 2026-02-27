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

interface EvalHooksOptions {
  readonly fixtureManager: FixtureManager
  readonly sessionExport: boolean
  readonly reportsDir?: string
}

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
