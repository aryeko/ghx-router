import { spawnSync } from "node:child_process"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"

export type SessionExportConfig = {
  sessionId: string
  destDir: string
}

export type SessionExportResult = { ok: true } | { ok: false; reason: string }

export async function exportSession(config: SessionExportConfig): Promise<SessionExportResult> {
  const { sessionId, destDir } = config

  const result = spawnSync("opencode", ["export", sessionId], {
    encoding: "utf8",
    timeout: 30_000,
  })

  if (result.error) {
    return { ok: false, reason: `spawn error: ${result.error.message}` }
  }

  if (result.status !== 0) {
    const stderr = typeof result.stderr === "string" ? result.stderr.trim() : ""
    return { ok: false, reason: `opencode export exited ${result.status ?? "null"}: ${stderr}` }
  }

  const output = typeof result.stdout === "string" ? result.stdout.trim() : ""
  if (output.length === 0) {
    return { ok: false, reason: "opencode export produced no output" }
  }

  const destPath = join(destDir, "session.jsonl")
  try {
    await writeFile(destPath, `${output}\n`, "utf8")
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: `failed to write session export: ${reason}` }
  }

  return { ok: true }
}
