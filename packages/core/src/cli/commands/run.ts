import type { TaskRequest } from "../../core/contracts/task.js"
import { executeTask } from "../../core/routing/engine.js"
import { createGithubClient } from "../../gql/client.js"

const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql"

function parseRunArgs(argv: string[]): {
  task: string
  input: Record<string, unknown>
  skipGhPreflight: boolean
} {
  const [task, ...rest] = argv
  if (!task || task.trim().length === 0) {
    throw new Error("Usage: ghx run <task> --input '<json>' [--check-gh-preflight]")
  }

  const inputIndex = rest.findIndex((arg) => arg === "--input")
  const inlineInput = rest.find((arg) => arg.startsWith("--input="))
  const inputCandidate = inputIndex >= 0 ? rest[inputIndex + 1] : undefined
  const inputRaw =
    inputCandidate && !inputCandidate.startsWith("--")
      ? inputCandidate
      : inlineInput
        ? inlineInput.slice("--input=".length)
        : undefined

  if (!inputRaw) {
    throw new Error("Missing --input JSON")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(inputRaw)
  } catch {
    throw new Error("Invalid JSON for --input")
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("--input must be a JSON object")
  }

  const skipGhPreflight = !rest.includes("--check-gh-preflight")

  return { task, input: parsed as Record<string, unknown>, skipGhPreflight }
}

function resolveGithubToken(): string {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (!token || token.trim().length === 0) {
    throw new Error("Missing GITHUB_TOKEN or GH_TOKEN for GraphQL transport")
  }

  return token
}

async function executeGraphqlRequest<TData>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "user-agent": "ghx",
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  })

  const payload = (await response.json()) as {
    data?: TData
    errors?: Array<{ message?: string }>
    message?: string
  }

  if (!response.ok) {
    const message =
      payload.message ?? `GitHub GraphQL request failed with status ${response.status}`
    throw new Error(message)
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const message = payload.errors[0]?.message ?? "GitHub GraphQL returned errors"
    throw new Error(message)
  }

  if (payload.data === undefined) {
    throw new Error("GitHub GraphQL response missing data")
  }

  return payload.data
}

export async function runCommand(argv: string[] = []): Promise<number> {
  if (argv.length === 0) {
    process.stdout.write("Usage: ghx run <task> --input '<json>' [--check-gh-preflight]\n")
    return 1
  }

  const { task, input, skipGhPreflight } = parseRunArgs(argv)
  const githubToken = resolveGithubToken()

  const githubClient = createGithubClient({
    async execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
      return executeGraphqlRequest<TData>(githubToken, query, variables)
    },
  })

  const request: TaskRequest = {
    task,
    input,
  }

  const result = await executeTask(request, {
    githubClient,
    githubToken,
    skipGhPreflight,
  })

  process.stdout.write(`${JSON.stringify(result)}\n`)
  return 0
}
