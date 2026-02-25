import { compactChainResult } from "@core/cli/formatters/compact.js"
import { executeTasks } from "@core/core/routing/engine/index.js"
import { createResolutionCache } from "@core/core/routing/resolution-cache.js"
import { createGithubClient } from "@core/gql/github-client.js"
import type { GraphqlError, GraphqlRawResult } from "@core/gql/transport.js"
import { resolveGraphqlUrl } from "@core/gql/transport.js"
import { readStdin } from "./run.js"

const GITHUB_GRAPHQL_ENDPOINT = resolveGraphqlUrl()

interface ParsedChainFlags {
  stepsSource: "stdin" | { raw: string }
  skipGhPreflight: boolean
  verbose: boolean
}

export function parseChainFlags(argv: string[]): ParsedChainFlags {
  const stepsIndex = argv.findIndex((arg) => arg === "--steps")
  const inlineSteps = argv.find((arg) => arg.startsWith("--steps="))
  const stepsCandidate = stepsIndex >= 0 ? argv[stepsIndex + 1] : undefined
  const verbose = argv.includes("--verbose")

  if (stepsCandidate === "-") {
    const skipGhPreflight = !argv.includes("--check-gh-preflight")
    return { stepsSource: "stdin", skipGhPreflight, verbose }
  }

  const stepsRaw =
    stepsCandidate && !stepsCandidate.startsWith("--")
      ? stepsCandidate
      : inlineSteps
        ? inlineSteps.slice("--steps=".length)
        : undefined

  if (!stepsRaw) {
    throw new Error("Missing --steps JSON")
  }

  const skipGhPreflight = !argv.includes("--check-gh-preflight")
  return { stepsSource: { raw: stepsRaw }, skipGhPreflight, verbose }
}

function parseJsonSteps(raw: string): Array<{ task: string; input: Record<string, unknown> }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("Invalid JSON for --steps")
  }

  if (!Array.isArray(parsed)) {
    throw new Error("--steps must be a JSON array")
  }

  for (const item of parsed) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).task !== "string" ||
      typeof (item as Record<string, unknown>).input !== "object" ||
      (item as Record<string, unknown>).input === null
    ) {
      throw new Error('Each step must have "task" (string) and "input" (object) fields')
    }
  }

  return parsed as Array<{ task: string; input: Record<string, unknown> }>
}

function resolveGithubToken(): string {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (!token || token.trim().length === 0) {
    throw new Error("Missing GITHUB_TOKEN or GH_TOKEN for GraphQL transport")
  }

  return token
}

type GqlPayload<TData> = {
  data?: TData
  errors?: GraphqlError[]
  message?: string
}

async function fetchGqlPayload<TData>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GqlPayload<TData>> {
  const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "user-agent": "ghx",
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
    signal: AbortSignal.timeout(30_000),
  })

  let payload: GqlPayload<TData>
  try {
    payload = (await response.json()) as GqlPayload<TData>
  } catch {
    throw new Error(`GitHub GraphQL returned non-JSON response (status ${response.status})`)
  }

  if (!response.ok) {
    const message =
      payload.message ?? `GitHub GraphQL request failed with status ${response.status}`
    throw new Error(message)
  }

  return payload
}

async function executeGraphqlRequest<TData>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const payload = await fetchGqlPayload<TData>(token, query, variables)

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const message = payload.errors[0]?.message ?? "GitHub GraphQL returned errors"
    throw new Error(message)
  }

  if (payload.data === undefined) {
    throw new Error("GitHub GraphQL response missing data")
  }

  return payload.data
}

async function executeRawGraphqlRequest<TData>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphqlRawResult<TData>> {
  const payload = await fetchGqlPayload<TData>(token, query, variables)
  return {
    data: payload.data,
    errors: payload.errors?.length ? payload.errors : undefined,
  }
}

export async function chainCommand(argv: string[] = []): Promise<number> {
  if (argv.length === 0) {
    process.stdout.write(
      "Usage: ghx chain --steps '<json-array>' | --steps - [--check-gh-preflight] [--verbose]\n",
    )
    return 1
  }

  try {
    const { stepsSource, skipGhPreflight, verbose } = parseChainFlags(argv)
    const steps =
      stepsSource === "stdin" ? parseJsonSteps(await readStdin()) : parseJsonSteps(stepsSource.raw)
    const githubToken = resolveGithubToken()

    const githubClient = createGithubClient({
      async execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
        return executeGraphqlRequest<TData>(githubToken, query, variables)
      },
      async executeRaw<TData>(
        query: string,
        variables?: Record<string, unknown>,
      ): Promise<GraphqlRawResult<TData>> {
        return executeRawGraphqlRequest<TData>(githubToken, query, variables)
      },
    })

    const resolutionCache = createResolutionCache()
    const result = await executeTasks(steps, {
      githubClient,
      githubToken,
      skipGhPreflight,
      resolutionCache,
    })

    const output = verbose ? result : compactChainResult(result)
    process.stdout.write(`${JSON.stringify(output, null, verbose ? 2 : undefined)}\n`)
    return result.status === "success" || result.status === "partial" ? 0 : 1
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`${message}\n`)
    return 1
  }
}
