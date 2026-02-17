import { createSign } from "node:crypto"
import { readFile } from "node:fs/promises"

type FixtureAppAuthConfig = {
  clientId: string
  privateKey: string
}

function parseInlinePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n")
}

async function resolvePrivateKeyFromEnv(): Promise<string | null> {
  const inline = process.env.BENCH_FIXTURE_GH_APP_PRIVATE_KEY
  if (typeof inline === "string" && inline.trim().length > 0) {
    return parseInlinePrivateKey(inline)
  }

  const keyPath = process.env.BENCH_FIXTURE_GH_APP_PRIVATE_KEY_PATH
  if (typeof keyPath === "string" && keyPath.trim().length > 0) {
    return await readFile(keyPath, "utf8")
  }

  return null
}

async function resolveAppAuthConfigFromEnv(): Promise<FixtureAppAuthConfig | null> {
  const clientId = process.env.BENCH_FIXTURE_GH_APP_CLIENT_ID?.trim() ?? ""
  const privateKey = await resolvePrivateKeyFromEnv()

  const hasAnyAuthInput = clientId.length > 0 || privateKey !== null
  if (!hasAnyAuthInput) {
    return null
  }

  if (clientId.length === 0 || privateKey === null || privateKey.trim().length === 0) {
    throw new Error(
      "Incomplete fixture app auth config. Provide BENCH_FIXTURE_GH_APP_CLIENT_ID and BENCH_FIXTURE_GH_APP_PRIVATE_KEY or BENCH_FIXTURE_GH_APP_PRIVATE_KEY_PATH.",
    )
  }

  return {
    clientId,
    privateKey,
  }
}

function buildAppJwt(clientId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({
      iat: now - 60,
      exp: now + 600,
      iss: clientId,
    }),
  ).toString("base64url")
  const data = `${header}.${payload}`
  const signature = createSign("RSA-SHA256")
    .update(data)
    .end()
    .sign(privateKey)
    .toString("base64url")
  return `${data}.${signature}`
}

async function discoverInstallationId(jwt: string): Promise<string> {
  const response = await fetch("https://api.github.com/app/installations", {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "ghx-benchmark-fixtures",
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to list app installations (${response.status}): ${body}`)
  }

  const installations = (await response.json()) as Array<{ id?: unknown }>
  const first = installations[0]
  if (!first || typeof first.id !== "number") {
    throw new Error("No installations found for the fixture GitHub App")
  }

  return String(first.id)
}

async function mintInstallationToken(config: FixtureAppAuthConfig): Promise<string> {
  const jwt = buildAppJwt(config.clientId, config.privateKey)
  const installationId = await discoverInstallationId(jwt)

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "ghx-benchmark-fixtures",
      },
    },
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to mint fixture app installation token (${response.status}): ${body}`)
  }

  const payload = (await response.json()) as { token?: unknown }
  if (typeof payload.token !== "string" || payload.token.length === 0) {
    throw new Error("Fixture app token response missing token")
  }

  return payload.token
}

export async function mintFixtureAppToken(): Promise<string | null> {
  const config = await resolveAppAuthConfigFromEnv()
  if (config === null) {
    return null
  }

  return await mintInstallationToken(config)
}

export async function applyFixtureAppAuthIfConfigured(): Promise<() => void> {
  const config = await resolveAppAuthConfigFromEnv()
  if (config === null) {
    return () => undefined
  }

  const token = await mintInstallationToken(config)
  const previousGhToken = process.env.GH_TOKEN
  const previousGithubToken = process.env.GITHUB_TOKEN

  process.env.GH_TOKEN = token
  process.env.GITHUB_TOKEN = token

  return () => {
    if (previousGhToken === undefined) {
      delete process.env.GH_TOKEN
    } else {
      process.env.GH_TOKEN = previousGhToken
    }

    if (previousGithubToken === undefined) {
      delete process.env.GITHUB_TOKEN
    } else {
      process.env.GITHUB_TOKEN = previousGithubToken
    }
  }
}
