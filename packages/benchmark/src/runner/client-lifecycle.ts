import { spawnSync } from "node:child_process"
import { lstatSync } from "node:fs"
import { lstat, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { delimiter, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createOpencode } from "@opencode-ai/sdk"
import type { BenchmarkMode, Scenario } from "../domain/types.js"
import { isObject } from "../utils/guards.js"
import {
  AGENT_DIRECT_INSTRUCTION,
  MCP_INSTRUCTION,
  modeInstructions,
} from "./mode/mode-instructions.js"
import * as ghxRouterPreflight from "./preflight/ghx-router-preflight.js"

const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url))
const BENCHMARK_PACKAGE_ROOT = resolve(MODULE_DIR, "..", "..")
const BENCHMARK_BIN_DIR = join(BENCHMARK_PACKAGE_ROOT, "bin")
const GHX_BENCHMARK_ALIAS_PATH = join(BENCHMARK_BIN_DIR, "ghx")
const GHX_SKILL_ASSET_PATH = resolve(BENCHMARK_PACKAGE_ROOT, "../core/skills/using-ghx/SKILL.md")
const OPENCODE_PORT = Number.parseInt(process.env.BENCH_OPENCODE_PORT ?? "3000", 10)

function unwrapData<T>(value: unknown, label: string): T {
  if (isObject(value) && "data" in value) {
    const wrapped = value as { data?: unknown; error?: unknown }
    if (wrapped.error) {
      throw new Error(`${label} returned error payload`)
    }
    return wrapped.data as T
  }

  return value as T
}

async function ensureBenchmarkGhxAliasReady(): Promise<void> {
  try {
    await lstat(GHX_BENCHMARK_ALIAS_PATH)
  } catch {
    throw new Error(
      "ghx_preflight_failed: benchmark ghx alias missing; run pnpm --filter @ghx-dev/core run build and ensure packages/benchmark/bin/ghx points to packages/core/dist/cli/index.js",
    )
  }
}

function assertBenchmarkGhxAliasReady(): void {
  try {
    lstatSync(GHX_BENCHMARK_ALIAS_PATH)
  } catch {
    throw new Error(
      "ghx_preflight_failed: benchmark ghx alias missing; run pnpm --filter @ghx-dev/core run build and ensure packages/benchmark/bin/ghx points to packages/core/dist/cli/index.js",
    )
  }
}

export function assertGhxRouterPreflight(scenarios: Scenario[]): void {
  ghxRouterPreflight.assertGhxRouterPreflight(scenarios, {
    ghxCommand: GHX_BENCHMARK_ALIAS_PATH,
    ensureGhxAliasReady: assertBenchmarkGhxAliasReady,
  })
}

async function loadGhxSkillInstruction(): Promise<string> {
  return readFile(GHX_SKILL_ASSET_PATH, "utf8")
}

function resolveGhTokenFromCli(): string | null {
  const result = spawnSync("gh", ["auth", "token"], {
    encoding: "utf8",
    timeout: 5000,
    killSignal: "SIGTERM",
  })
  if (result.error || result.status !== 0) {
    return null
  }

  const token = typeof result.stdout === "string" ? result.stdout.trim() : ""
  return token.length > 0 ? token : null
}

export async function withIsolatedBenchmarkClient<T>(
  mode: BenchmarkMode,
  providerId: string,
  modelId: string,
  run: (client: unknown) => Promise<T>,
): Promise<T> {
  const isolatedXdgConfigHome = await mkdtemp(join(tmpdir(), "ghx-benchmark-opencode-"))
  const instructions = await modeInstructions(mode, loadGhxSkillInstruction)
  if (mode === "ghx") {
    await ensureBenchmarkGhxAliasReady()
  }

  const previousEnv = {
    OPENCODE_CONFIG: process.env.OPENCODE_CONFIG,
    OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    GH_TOKEN: process.env.GH_TOKEN,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    PATH: process.env.PATH,
  }

  const ghToken = previousEnv.GH_TOKEN ?? previousEnv.GITHUB_TOKEN ?? resolveGhTokenFromCli()

  delete process.env.OPENCODE_CONFIG
  delete process.env.OPENCODE_CONFIG_DIR
  process.env.XDG_CONFIG_HOME = isolatedXdgConfigHome
  if (ghToken) {
    process.env.GH_TOKEN = ghToken
    process.env.GITHUB_TOKEN = ghToken
  }
  if (mode === "ghx") {
    process.env.PATH =
      previousEnv.PATH && previousEnv.PATH.length > 0
        ? `${BENCHMARK_BIN_DIR}${delimiter}${previousEnv.PATH}`
        : BENCHMARK_BIN_DIR
  }

  let server: { close: () => void } | null = null

  try {
    const opencode = await createOpencode({
      port: Number.isInteger(OPENCODE_PORT) && OPENCODE_PORT > 0 ? OPENCODE_PORT : 3000,
      config: {
        model: `${providerId}/${modelId}`,
        instructions,
        plugin: [],
        mcp: {},
        agent: {},
        command: {},
        permission: {
          edit: "deny",
          bash: "allow",
          webfetch: "allow",
          doom_loop: "deny",
          external_directory: "deny",
        },
      },
    })

    server = opencode.server
    const client = opencode.client

    const configApi = (
      client as {
        config?: { get?: (args?: Record<string, unknown>) => Promise<unknown> }
      }
    ).config
    if (configApi?.get) {
      const configResponse = await configApi.get({ url: "/config" })
      const resolvedConfig = unwrapData<Record<string, unknown>>(configResponse, "config.get")
      const configuredInstructions = Array.isArray(resolvedConfig.instructions)
        ? resolvedConfig.instructions
        : []
      const configuredPlugins = Array.isArray(resolvedConfig.plugin) ? resolvedConfig.plugin : []

      if (mode === "ghx") {
        const hasGhxInstructions = configuredInstructions.some(
          (instruction) => typeof instruction === "string" && instruction.trim().length > 0,
        )

        if (!hasGhxInstructions || configuredPlugins.length > 0) {
          throw new Error(
            `benchmark_config_invalid: expected non-empty ghx instructions and no plugins, got instructions=${configuredInstructions.length}, plugins=${configuredPlugins.length}`,
          )
        }
      } else {
        const expectedInstruction =
          mode === "agent_direct" ? AGENT_DIRECT_INSTRUCTION : MCP_INSTRUCTION
        const hasExpectedInstruction = configuredInstructions.some(
          (instruction) => instruction === expectedInstruction,
        )

        if (!hasExpectedInstruction || configuredPlugins.length > 0) {
          throw new Error(
            `benchmark_config_invalid: expected ${mode} instruction and no plugins, got instructions=${configuredInstructions.length}, plugins=${configuredPlugins.length}`,
          )
        }
      }
    }

    return await run(client)
  } finally {
    if (server) {
      server.close()
    }

    if (previousEnv.OPENCODE_CONFIG === undefined) {
      delete process.env.OPENCODE_CONFIG
    } else {
      process.env.OPENCODE_CONFIG = previousEnv.OPENCODE_CONFIG
    }

    if (previousEnv.OPENCODE_CONFIG_DIR === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR
    } else {
      process.env.OPENCODE_CONFIG_DIR = previousEnv.OPENCODE_CONFIG_DIR
    }

    if (previousEnv.XDG_CONFIG_HOME === undefined) {
      delete process.env.XDG_CONFIG_HOME
    } else {
      process.env.XDG_CONFIG_HOME = previousEnv.XDG_CONFIG_HOME
    }

    if (previousEnv.GH_TOKEN === undefined) {
      delete process.env.GH_TOKEN
    } else {
      process.env.GH_TOKEN = previousEnv.GH_TOKEN
    }

    if (previousEnv.GITHUB_TOKEN === undefined) {
      delete process.env.GITHUB_TOKEN
    } else {
      process.env.GITHUB_TOKEN = previousEnv.GITHUB_TOKEN
    }

    if (previousEnv.PATH === undefined) {
      delete process.env.PATH
    } else {
      process.env.PATH = previousEnv.PATH
    }

    await rm(isolatedXdgConfigHome, { recursive: true, force: true })
  }
}
