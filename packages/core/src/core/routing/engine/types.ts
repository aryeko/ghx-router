import type { CliCommandRunner } from "@core/core/execution/adapters/cli-capability-adapter.js"
import type { OperationCard } from "@core/core/registry/types.js"
import type { RouteReasonCode } from "@core/core/routing/reason-codes.js"
import type { GithubClient } from "@core/gql/github-client.js"
import type { ResolutionCache } from "../resolution-cache.js"

export type StepRoute = "gql-query" | "gql-mutation" | "cli"

export type ClassifiedStep = {
  route: StepRoute
  card: OperationCard
  index: number
  request: { task: string; input: Record<string, unknown> }
}

export type ExecutionDeps = {
  githubClient: GithubClient
  githubToken?: string | null
  cliRunner?: CliCommandRunner
  ghCliAvailable?: boolean
  ghAuthenticated?: boolean
  skipGhPreflight?: boolean
  reason?: RouteReasonCode
  resolutionCache?: ResolutionCache
}
