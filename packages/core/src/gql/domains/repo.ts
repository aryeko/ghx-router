import { assertRepoAndPaginationInput, assertRepoInput } from "../assertions.js"
import type { RepoIssueTypesListQuery } from "../operations/repo-issue-types-list.generated.js"
import { getSdk as getRepoIssueTypesListSdk } from "../operations/repo-issue-types-list.generated.js"
import type { RepoLabelsListQuery } from "../operations/repo-labels-list.generated.js"
import { getSdk as getRepoLabelsListSdk } from "../operations/repo-labels-list.generated.js"
import type { RepoViewQuery } from "../operations/repo-view.generated.js"
import { getSdk } from "../operations/repo-view.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { createGraphqlRequestClient } from "../transport.js"
import type {
  RepoIssueTypesListData,
  RepoIssueTypesListInput,
  RepoLabelsListData,
  RepoLabelsListInput,
  RepoViewData,
  RepoViewInput,
} from "../types.js"

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

export async function runRepoLabelsList(
  transport: GraphqlTransport,
  input: RepoLabelsListInput,
): Promise<RepoLabelsListData> {
  assertRepoAndPaginationInput(input)
  const sdk = getRepoLabelsListSdk(createGraphqlRequestClient(transport))
  const result: RepoLabelsListQuery = await sdk.RepoLabelsList(input)
  if (!result.repository) {
    throw new Error(`Repository ${input.owner}/${input.name} not found`)
  }
  const conn = result.repository?.labels
  return {
    items: (conn?.nodes ?? []).map((n) => ({
      id: n?.id ?? null,
      name: n?.name ?? null,
      description: n?.description ?? null,
      color: n?.color ?? null,
      isDefault: n?.isDefault ?? null,
    })),
    pageInfo: {
      hasNextPage: conn?.pageInfo.hasNextPage ?? false,
      endCursor: conn?.pageInfo.endCursor ?? null,
    },
  }
}

export async function runRepoIssueTypesList(
  transport: GraphqlTransport,
  input: RepoIssueTypesListInput,
): Promise<RepoIssueTypesListData> {
  assertRepoAndPaginationInput(input)
  const sdk = getRepoIssueTypesListSdk(createGraphqlRequestClient(transport))
  const result: RepoIssueTypesListQuery = await sdk.RepoIssueTypesList(input)
  if (!result.repository) {
    throw new Error(`Repository ${input.owner}/${input.name} not found`)
  }
  const conn = result.repository?.issueTypes
  return {
    items: (conn?.nodes ?? []).map((n) => ({
      id: n?.id ?? null,
      name: n?.name ?? null,
      color: n?.color != null ? String(n.color) : null,
      isEnabled: n?.isEnabled ?? null,
    })),
    pageInfo: {
      hasNextPage: conn?.pageInfo.hasNextPage ?? false,
      endCursor: conn?.pageInfo.endCursor ?? null,
    },
  }
}
