import { assertRepoInput } from "../assertions.js"
import type { RepoViewQuery } from "../operations/repo-view.generated.js"
import { getSdk } from "../operations/repo-view.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { createGraphqlRequestClient } from "../transport.js"
import type { RepoViewData, RepoViewInput } from "../types.js"

export async function runRepoView(
  transport: GraphqlTransport,
  input: RepoViewInput,
): Promise<RepoViewData> {
  assertRepoInput(input)
  const sdk = getSdk(createGraphqlRequestClient(transport))
  const result: RepoViewQuery = await sdk.RepoView(input)
  if (!result.repository) {
    throw new Error("Repository not found")
  }

  return {
    id: result.repository.id,
    name: result.repository.name,
    nameWithOwner: result.repository.nameWithOwner,
    isPrivate: result.repository.isPrivate,
    stargazerCount: result.repository.stargazerCount,
    forkCount: result.repository.forkCount,
    url: result.repository.url,
    defaultBranch: result.repository.defaultBranchRef?.name ?? null,
  }
}
