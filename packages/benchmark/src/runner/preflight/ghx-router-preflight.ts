import { spawnSync } from "node:child_process"
import type { Scenario } from "../../domain/types.js"

type CapabilityListItem = {
  capability_id: string
}

type SpawnResult = {
  status: number | null
  stdout?: string | null
  stderr?: string | null
}

type SpawnSyncFn = (command: string, args: string[], options: { encoding: "utf8" }) => SpawnResult

function parseGhxCapabilities(raw: string): string[] {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (error) {
    throw new Error(
      `ghx capabilities JSON invalid: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`ghx capabilities JSON invalid: expected array but got ${typeof parsed}`)
  }

  return parsed
    .map((item) => (isObject(item) ? (item as CapabilityListItem).capability_id : null))
    .filter((item): item is string => typeof item === "string" && item.length > 0)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function ghOk(args: string[], spawnSyncFn: SpawnSyncFn = spawnSync): boolean {
  const result = spawnSyncFn("gh", args, { encoding: "utf8" })
  return result.status === 0
}

export function assertGhxRouterPreflight(
  scenarios: Scenario[],
  options: {
    ghxCommand: string
    ensureGhxAliasReady: () => void
    spawnSyncFn?: SpawnSyncFn
  },
): void {
  if (process.platform === "win32") {
    throw new Error(
      "ghx_preflight_failed: benchmark ghx preflight currently supports Unix-like environments only (symlinked benchmark/bin/ghx)",
    )
  }

  const spawnSyncFn = options.spawnSyncFn ?? spawnSync
  options.ensureGhxAliasReady()

  const authStatus = spawnSyncFn("gh", ["auth", "status"], { encoding: "utf8" })
  if (authStatus.status !== 0) {
    const stderr = typeof authStatus.stderr === "string" ? authStatus.stderr.trim() : ""
    const message = stderr.length > 0 ? stderr : "gh auth status failed"
    throw new Error(`ghx_preflight_failed: ${message}`)
  }

  const result = spawnSyncFn(options.ghxCommand, ["capabilities", "list", "--json"], {
    encoding: "utf8",
  })

  if (result.status !== 0) {
    const stderr = typeof result.stderr === "string" ? result.stderr.trim() : ""
    const message = stderr.length > 0 ? stderr : "failed to list ghx capabilities"
    throw new Error(`ghx_preflight_failed: ${message}`)
  }

  const stdout = typeof result.stdout === "string" ? result.stdout : ""
  const capabilities = parseGhxCapabilities(stdout)
  if (capabilities.length === 0) {
    throw new Error(
      "ghx_preflight_failed: ghx capabilities list returned no capabilities; run pnpm --filter @ghx-dev/core run build",
    )
  }

  const capabilitySet = new Set(capabilities)
  const missingTasks = scenarios
    .map((scenario) => scenario.task)
    .filter((task, index, all) => all.indexOf(task) === index)
    .filter((task) => !capabilitySet.has(task))

  if (missingTasks.length > 0) {
    throw new Error(
      `ghx_preflight_failed: missing capabilities for selected scenarios: ${missingTasks.join(", ")}`,
    )
  }
}
