import type { CliCommandRunner } from "@core/core/execution/adapters/cli-capability-adapter.js"
import { createSafeCliCommandRunner } from "@core/core/execution/cli/safe-runner.js"

export type { CliCommandRunner }

export type CliEnvironmentState = {
  ghCliAvailable: boolean
  ghAuthenticated: boolean
}

const CLI_ENV_CACHE_TTL_MS = 30_000
const cliEnvironmentCache = new WeakMap<
  CliCommandRunner,
  { value: CliEnvironmentState; expiresAt: number }
>()
const cliEnvironmentInFlight = new WeakMap<CliCommandRunner, Promise<CliEnvironmentState>>()

export const defaultCliRunner = createSafeCliCommandRunner()

async function detectCliEnvironment(runner: CliCommandRunner): Promise<CliEnvironmentState> {
  const version = await runner.run("gh", ["--version"], 1_500).catch(() => null)
  if (!version || version.exitCode !== 0) {
    return { ghCliAvailable: false, ghAuthenticated: false }
  }

  const auth = await runner.run("gh", ["auth", "status"], 2_500).catch(() => null)
  return { ghCliAvailable: true, ghAuthenticated: auth?.exitCode === 0 }
}

export async function detectCliEnvironmentCached(
  runner: CliCommandRunner,
): Promise<CliEnvironmentState> {
  const now = Date.now()
  const cached = cliEnvironmentCache.get(runner)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const inFlight = cliEnvironmentInFlight.get(runner)
  if (inFlight) {
    return inFlight
  }

  const probePromise = detectCliEnvironment(runner)
    .then((value) => {
      cliEnvironmentCache.set(runner, {
        value,
        expiresAt: Date.now() + CLI_ENV_CACHE_TTL_MS,
      })
      cliEnvironmentInFlight.delete(runner)
      return value
    })
    .catch((error) => {
      cliEnvironmentInFlight.delete(runner)
      throw error
    })

  cliEnvironmentInFlight.set(runner, probePromise)
  return probePromise
}
