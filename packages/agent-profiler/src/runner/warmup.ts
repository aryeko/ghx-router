import type { SessionProvider } from "../contracts/provider.js"
import type { Logger } from "../shared/logger.js"
import type { BaseScenario } from "../types/scenario.js"

export interface WarmupResult {
  readonly skipped: boolean
  readonly durationMs: number
  readonly error?: string
}

export async function runWarmup(
  provider: SessionProvider,
  scenario: BaseScenario,
  systemInstructions: string,
  logger: Logger,
): Promise<WarmupResult> {
  const start = Date.now()
  try {
    logger.info("Running warmup iteration...")
    const handle = await provider.createSession({
      systemInstructions,
      scenarioId: scenario.id,
      iteration: -1,
    })
    try {
      await provider.prompt(handle, scenario.prompt, scenario.timeoutMs)
    } finally {
      try {
        await provider.destroySession(handle)
      } catch (destroyErr) {
        logger.warn(
          `Failed to destroy warmup session: ${destroyErr instanceof Error ? destroyErr.message : String(destroyErr)}`,
        )
      }
    }
    const durationMs = Date.now() - start
    logger.info(`Warmup completed in ${durationMs}ms`)
    return { skipped: false, durationMs }
  } catch (err) {
    const durationMs = Date.now() - start
    const message = err instanceof Error ? err.message : String(err)
    logger.warn(`Warmup failed (non-fatal): ${message}`)
    return { skipped: false, durationMs, error: message }
  }
}
