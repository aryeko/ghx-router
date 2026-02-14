import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { createOpencode } from "@opencode-ai/sdk"
import { describe, expect, it } from "vitest"

type CommandResult = {
  status: number
  stdout: string
  stderr: string
}

function run(command: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  })

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

function runOrThrow(command: string, args: string[], cwd: string): CommandResult {
  const result = run(command, args, cwd)
  if (result.status !== 0) {
    throw new Error(
      [`Command failed: ${command} ${args.join(" ")}`, `cwd: ${cwd}`, result.stdout, result.stderr].join("\n")
    )
  }

  return result
}

function unwrapData<T>(value: unknown): T {
  if (typeof value === "object" && value !== null && "data" in value) {
    return (value as { data: T }).data
  }

  return value as T
}

function asMessageArray(value: unknown): Array<{
  info?: { role?: string }
  parts?: Array<{ type?: string; text?: string }>
}> {
  const isMessageLikeArray = (candidate: unknown): candidate is Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }> =>
    Array.isArray(candidate) && candidate.every((entry) => typeof entry === "object" && entry !== null)

  if (Array.isArray(value)) {
    return value as Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }>
  }

  const queue: unknown[] = [value]
  let depth = 0
  while (queue.length > 0 && depth < 6) {
    const current = queue.shift()
    if (!current || typeof current !== "object") {
      depth += 1
      continue
    }

    for (const nested of Object.values(current as Record<string, unknown>)) {
      if (isMessageLikeArray(nested)) {
        return nested
      }

      if (nested && typeof nested === "object") {
        queue.push(nested)
      }
    }
    depth += 1
  }

  return []
}

function extractAssistantTextFromPromptResult(value: unknown): string {
  const payload = unwrapData<unknown>(value)
  if (typeof payload !== "object" || payload === null) {
    return ""
  }

  const root = payload as {
    parts?: Array<{ type?: string; text?: string }>
    message?: { parts?: Array<{ type?: string; text?: string }> }
  }

  const parts = Array.isArray(root.parts)
    ? root.parts
    : Array.isArray(root.message?.parts)
      ? root.message.parts
      : []

  return parts.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n")
}

function getSessionApi(client: unknown): {
  create: (options: Record<string, unknown>) => Promise<unknown>
  promptAsync: (options: Record<string, unknown>) => Promise<unknown>
  messages: (options: Record<string, unknown>) => Promise<unknown>
} {
  const session = (client as unknown as { session?: Record<string, unknown> }).session
  if (!session) {
    throw new Error("SDK client has no session API")
  }

  const create = session.create
  const promptAsync = session.promptAsync
  const messages = session.messages

  if (typeof create !== "function" || typeof promptAsync !== "function" || typeof messages !== "function") {
    throw new Error("SDK session API missing required methods")
  }

  return {
    create: (options: Record<string, unknown>) =>
      (create as (this: unknown, options: Record<string, unknown>) => Promise<unknown>).call(session, options),
    promptAsync: (options: Record<string, unknown>) =>
      (promptAsync as (this: unknown, options: Record<string, unknown>) => Promise<unknown>).call(session, options),
    messages: (options: Record<string, unknown>) =>
      (messages as (this: unknown, options: Record<string, unknown>) => Promise<unknown>).call(session, options),
  }
}

async function waitForMessages(
  sessionApi: { messages: (options: Record<string, unknown>) => Promise<unknown> },
  sessionId: string,
  timeoutMs: number
): Promise<unknown> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const messagesResult = await sessionApi.messages({
      url: "/session/{id}/messages",
      path: { id: sessionId },
    })

    const payload = unwrapData<unknown>(messagesResult)
    const messages = asMessageArray(payload)
    if (messages.length > 0) {
      return payload
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return []
}

const maybeIt = process.env.OPENAI_API_KEY ? it : it.skip

describe("ghx setup OpenCode skill e2e", () => {
  maybeIt("uses SDK agent session in isolated config and runs ghx capabilities list", async () => {
    const workspacePath = fileURLToPath(new URL("../../../../", import.meta.url))
    const tempRoot = mkdtempSync(join(tmpdir(), "ghx-e2e-sdk-"))
    const packDir = join(tempRoot, "pack")
    const projectDir = join(tempRoot, "project")
    const isolatedXdgConfig = mkdtempSync(join(tmpdir(), "ghx-e2e-sdk-xdg-"))
    const originalCwd = process.cwd()
    const originalXdg = process.env.XDG_CONFIG_HOME

    runOrThrow("mkdir", ["-p", packDir, projectDir], workspacePath)
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({ name: "ghx-e2e-sdk-project", private: true, version: "0.0.0" }, null, 2),
      "utf8"
    )

    runOrThrow("pnpm", ["--filter", "@ghx-dev/core", "run", "build"], workspacePath)
    const packResult = runOrThrow("pnpm", ["--filter", "@ghx-dev/core", "pack", "--pack-destination", packDir], workspacePath)
    const tarballName = packResult.stdout
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.endsWith(".tgz"))

    expect(tarballName).toBeDefined()
    const tarballPath = (tarballName as string).startsWith("/") ? (tarballName as string) : join(packDir, tarballName as string)
    runOrThrow("pnpm", ["add", tarballPath], projectDir)
    runOrThrow("pnpm", ["exec", "ghx", "setup", "--scope", "project", "--yes"], projectDir)

    process.env.XDG_CONFIG_HOME = isolatedXdgConfig
    process.chdir(projectDir)

    const providerID = process.env.BENCH_PROVIDER_ID ?? "openai"
    const modelID = process.env.BENCH_MODEL_ID ?? "gpt-5.3-codex"

    const opencode = await createOpencode({
      port: 3000,
      config: {
        model: `${providerID}/${modelID}`,
        instructions: [],
        plugin: [],
        mcp: {},
        agent: {},
        command: {},
        permission: {
          edit: "deny",
          bash: "allow",
          webfetch: "deny",
          doom_loop: "deny",
          external_directory: "deny",
        },
      },
    })

    try {
      const sessionApi = getSessionApi(opencode.client)

      const sessionResult = await sessionApi.create({ url: "/session" })
      const session = unwrapData<{ id: string }>(sessionResult)

      const promptResult = await sessionApi.promptAsync({
        url: "/session/{id}/prompt_async",
        path: { id: session.id },
        body: {
          model: { providerID, modelID },
          parts: [
            {
              type: "text",
              text: [
                "Run this exact command: pnpm exec ghx capabilities list.",
                "Then return plain text containing only the command output.",
              ].join(" "),
            },
          ],
        },
      })

      const messagesPayload = await waitForMessages(sessionApi, session.id, 20000)
      const messages = asMessageArray(messagesPayload)

      const assistantTextFromMessages = messages
        .filter((message) => message.info?.role === "assistant")
        .flatMap((message) => message.parts ?? [])
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("\n")

      const assistantTextFromPrompt = extractAssistantTextFromPromptResult(promptResult)
      const assistantText = [assistantTextFromPrompt, assistantTextFromMessages].filter((chunk) => chunk.length > 0).join("\n")

      const assistantMessages = messages.filter((message) => message.info?.role === "assistant")
      const rawMessages = JSON.stringify(messages)
      const rawPrompt = JSON.stringify(promptResult)
      const combinedEvidence = `${assistantText}\n${rawMessages}\n${rawPrompt}`

      expect(rawPrompt.length).toBeGreaterThan(2)
      expect(combinedEvidence).toContain("repo.view")
      if (assistantMessages.length > 0) {
        expect(combinedEvidence).toContain("ghx capabilities list")
      }
    } finally {
      opencode.server.close()
      process.chdir(originalCwd)
      if (originalXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME
      } else {
        process.env.XDG_CONFIG_HOME = originalXdg
      }
    }
  }, 120000)
})
