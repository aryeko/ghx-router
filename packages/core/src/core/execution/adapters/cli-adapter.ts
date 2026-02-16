import type { ResultEnvelope } from "../../contracts/envelope.js"
import { mapErrorToCode } from "../../errors/map-error.js"
import { isRetryableErrorCode } from "../../errors/retryability.js"
import type { RouteReasonCode } from "../../routing/reason-codes.js"
import { normalizeError, normalizeResult } from "../normalizer.js"

export type CliAdapterRequest = {
  command: string
  args?: string[]
  timeoutMs?: number
  capabilityId?: string
  reason?: RouteReasonCode
}

export type CliRunResult = {
  stdout: string
  stderr: string
  exitCode: number
}

export type CliCommandRunner = {
  run(command: string, args: string[], timeoutMs: number): Promise<CliRunResult>
}

const DEFAULT_TIMEOUT_MS = 10_000

export async function runCliAdapter(
  runner: CliCommandRunner,
  request: CliAdapterRequest,
): Promise<ResultEnvelope<CliRunResult>> {
  try {
    const args = request.args ?? []
    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const result = await runner.run(request.command, args, timeoutMs)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: result.stderr || `CLI command failed with exit code ${result.exitCode}`,
          details: {
            adapter: "cli",
            exitCode: result.exitCode,
            command: request.command,
            args,
          },
          retryable: isRetryableErrorCode(code),
        },
        "cli",
        {
          capabilityId: request.capabilityId ?? "unknown",
          reason: request.reason,
        },
      )
    }

    return normalizeResult(result, "cli", {
      capabilityId: request.capabilityId ?? "unknown",
      reason: request.reason,
    })
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        details: {
          adapter: "cli",
          command: request.command,
          args: request.args ?? [],
        },
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      {
        capabilityId: request.capabilityId ?? "unknown",
        reason: request.reason,
      },
    )
  }
}
