import { spawn } from "node:child_process"

import type { CliCommandRunner } from "../adapters/cli-capability-adapter.js"

const DEFAULT_MAX_OUTPUT_BYTES = 1_000_000

type SafeRunnerOptions = {
  maxOutputBytes?: number
}

export function createSafeCliCommandRunner(options?: SafeRunnerOptions): CliCommandRunner {
  const maxOutputBytes = options?.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES

  return {
    run(command: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number }> {
      return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
          shell: false,
          stdio: ["ignore", "pipe", "pipe"]
        })

        const stdoutChunks: Buffer[] = []
        const stderrChunks: Buffer[] = []
        let stdoutSize = 0
        let stderrSize = 0
        let timedOut = false
        let overflowed = false
        let settled = false

        const timer = setTimeout(() => {
          timedOut = true
          child.kill("SIGKILL")
        }, timeoutMs)

        function settleError(error: Error): void {
          if (settled) {
            return
          }

          settled = true
          clearTimeout(timer)
          reject(error)
        }

        function settleSuccess(stdout: string, stderr: string, exitCode: number): void {
          if (settled) {
            return
          }

          settled = true
          clearTimeout(timer)
          resolve({ stdout, stderr, exitCode })
        }

        child.stdout?.on("data", (chunk: Buffer) => {
          if (overflowed) {
            return
          }

          stdoutSize += chunk.length
          if (stdoutSize + stderrSize > maxOutputBytes) {
            overflowed = true
            child.kill("SIGKILL")
            return
          }

          stdoutChunks.push(chunk)
        })

        child.stderr?.on("data", (chunk: Buffer) => {
          if (overflowed) {
            return
          }

          stderrSize += chunk.length
          if (stdoutSize + stderrSize > maxOutputBytes) {
            overflowed = true
            child.kill("SIGKILL")
            return
          }

          stderrChunks.push(chunk)
        })

        child.on("error", (error) => {
          settleError(error)
        })

        child.on("close", (code) => {
          if (timedOut) {
            settleError(new Error(`CLI command timed out after ${timeoutMs}ms`))
            return
          }

          if (overflowed) {
            settleError(new Error(`CLI output exceeded ${maxOutputBytes} bytes`))
            return
          }

          settleSuccess(
            Buffer.concat(stdoutChunks).toString("utf8"),
            Buffer.concat(stderrChunks).toString("utf8"),
            code ?? 1
          )
        })
      })
    }
  }
}
