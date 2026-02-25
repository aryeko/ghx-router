import { spawnSync } from "node:child_process"
import { lstat, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { delimiter, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { BenchmarkMode } from "@bench/domain/types.js"
import { createOpencode } from "@opencode-ai/sdk"
import { modeInstructions } from "../../runner/mode-instructions.js"
import { unwrapData } from "./unwrap.js"

const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url))
const BENCHMARK_PACKAGE_ROOT = resolve(MODULE_DIR, "../..", "..")
const BENCHMARK_BIN_DIR = join(BENCHMARK_PACKAGE_ROOT, "bin")
const GHX_BENCHMARK_ALIAS_PATH = join(BENCHMARK_BIN_DIR, "ghx")
const GHX_SKILL_ASSET_PATH = resolve(BENCHMARK_PACKAGE_ROOT, "../core/skills/using-ghx/SKILL.md")
const OPENCODE_PORT = Number.parseInt(process.env.BENCH_OPENCODE_PORT ?? "3000", 10)

async function ensureBenchmarkGhxAliasReady(): Promise<void> {
  try {
    await lstat(GHX_BENCHMARK_ALIAS_PATH)
  } catch {
    throw new Error(
      "ghx_preflight_failed: benchmark ghx alias missing; run pnpm --filter @ghx-dev/core run build and ensure packages/benchmark/bin/ghx points to packages/core/dist/cli/index.js",
    )
  }
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

type EnvSnapshot = {
  OPENCODE_CONFIG: string | undefined
  OPENCODE_CONFIG_DIR: string | undefined
  XDG_CONFIG_HOME: string | undefined
  GH_TOKEN: string | undefined
  GITHUB_TOKEN: string | undefined
  PATH: string | undefined
  cwd: string
}

function restoreEnv(previous: EnvSnapshot, tmpDir: string, didChdir: boolean): () => Promise<void> {
  return async () => {
    if (previous.OPENCODE_CONFIG === undefined) {
      delete process.env.OPENCODE_CONFIG
    } else {
      process.env.OPENCODE_CONFIG = previous.OPENCODE_CONFIG
    }

    if (previous.OPENCODE_CONFIG_DIR === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR
    } else {
      process.env.OPENCODE_CONFIG_DIR = previous.OPENCODE_CONFIG_DIR
    }

    if (previous.XDG_CONFIG_HOME === undefined) {
      delete process.env.XDG_CONFIG_HOME
    } else {
      process.env.XDG_CONFIG_HOME = previous.XDG_CONFIG_HOME
    }

    if (previous.GH_TOKEN === undefined) {
      delete process.env.GH_TOKEN
    } else {
      process.env.GH_TOKEN = previous.GH_TOKEN
    }

    if (previous.GITHUB_TOKEN === undefined) {
      delete process.env.GITHUB_TOKEN
    } else {
      process.env.GITHUB_TOKEN = previous.GITHUB_TOKEN
    }

    if (previous.PATH === undefined) {
      delete process.env.PATH
    } else {
      process.env.PATH = previous.PATH
    }

    if (didChdir) {
      process.chdir(previous.cwd)
    }

    await rm(tmpDir, { recursive: true, force: true })
  }
}

export interface BenchmarkClient {
  client: unknown
  systemInstruction: string
}

export async function openBenchmarkClient(
  mode: BenchmarkMode,
  providerId: string,
  modelId: string,
): Promise<{ client: unknown; systemInstruction: string; close: () => Promise<void> }> {
  const isolatedXdgConfigHome = await mkdtemp(join(tmpdir(), "ghx-benchmark-opencode-"))
  const instructions = await modeInstructions(mode, loadGhxSkillInstruction)
  const systemInstruction = instructions.join("\n\n")
  if (mode === "ghx") {
    await ensureBenchmarkGhxAliasReady()
  }

  const previousEnv: EnvSnapshot = {
    OPENCODE_CONFIG: process.env.OPENCODE_CONFIG,
    OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    GH_TOKEN: process.env.GH_TOKEN,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    PATH: process.env.PATH,
    cwd: process.cwd(),
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

  const sessionWorkdir = process.env.BENCH_SESSION_WORKDIR
  let teardown = restoreEnv(previousEnv, isolatedXdgConfigHome, false)
  if (sessionWorkdir) {
    try {
      process.chdir(sessionWorkdir)
      teardown = restoreEnv(previousEnv, isolatedXdgConfigHome, true)
    } catch (error) {
      await teardown()
      throw new Error(`benchmark_session_workdir_invalid: unable to chdir to "${sessionWorkdir}"`, {
        cause: error,
      })
    }
  }

  let server: { close: () => void } | null = null

  try {
    const opencode = await createOpencode({
      port: Number.isInteger(OPENCODE_PORT) && OPENCODE_PORT > 0 ? OPENCODE_PORT : 3000,
      config: {
        model: `${providerId}/${modelId}`,
        instructions: [],
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
      const configuredPlugins = Array.isArray(resolvedConfig.plugin) ? resolvedConfig.plugin : []

      if (configuredPlugins.length > 0) {
        throw new Error(
          `benchmark_config_invalid: expected no plugins, got plugins=${configuredPlugins.length}`,
        )
      }
    }

    const close = async () => {
      if (server) {
        server.close()
      }
      await teardown()
    }

    return { client, systemInstruction, close }
  } catch (error) {
    await teardown()
    throw error
  }
}

export async function withIsolatedBenchmarkClient<T>(
  mode: BenchmarkMode,
  providerId: string,
  modelId: string,
  run: (ctx: BenchmarkClient) => Promise<T>,
): Promise<T> {
  const { client, systemInstruction, close } = await openBenchmarkClient(mode, providerId, modelId)
  try {
    return await run({ client, systemInstruction })
  } finally {
    await close()
  }
}
