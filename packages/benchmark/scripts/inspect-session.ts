import { createOpencode } from "@opencode-ai/sdk"

type SessionMessage = {
  info: unknown
  parts: unknown[]
}

type SessionApi = {
  messages: (args: { path: { id: string } }) => Promise<SessionMessage[]>
}

type OpencodeClient = {
  session?: SessionApi
}

const PROVIDER_ID = process.env.BENCH_PROVIDER_ID ?? "openai"
const MODEL_ID = process.env.BENCH_MODEL_ID ?? "gpt-5.1-codex-mini"
const OPENCODE_PORT = Number.parseInt(process.env.BENCH_OPENCODE_PORT ?? "3000", 10)

async function main(): Promise<void> {
  const sessionId = process.argv[2]
  if (!sessionId) {
    throw new Error("Usage: tsx scripts/inspect-session.ts <session-id>")
  }

  const opencode = await createOpencode({
    port: Number.isInteger(OPENCODE_PORT) && OPENCODE_PORT > 0 ? OPENCODE_PORT : 3000,
    config: {
      model: `${PROVIDER_ID}/${MODEL_ID}`,
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

  try {
    const client = opencode.client as OpencodeClient
    const sessionApi = client.session
    if (!sessionApi || typeof sessionApi.messages !== "function") {
      throw new Error("session API is unavailable")
    }

    const response = await sessionApi.messages({ path: { id: sessionId } })

    process.stdout.write(`${JSON.stringify(response, null, 2)}\n`)
  } finally {
    opencode.server.close()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
