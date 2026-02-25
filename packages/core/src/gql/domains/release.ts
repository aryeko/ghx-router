import { assertReleaseViewInput, assertRepoAndPaginationInput } from "../assertions.js"
import type { ReleaseListQuery } from "../operations/release-list.generated.js"
import { getSdk as getReleaseListSdk } from "../operations/release-list.generated.js"
import type { ReleaseViewQuery } from "../operations/release-view.generated.js"
import { getSdk as getReleaseViewSdk } from "../operations/release-view.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { createGraphqlRequestClient } from "../transport.js"
import type {
  ReleaseItemData,
  ReleaseListData,
  ReleaseListInput,
  ReleaseViewData,
  ReleaseViewInput,
} from "../types.js"

type ReleaseNode = {
  databaseId?: number | null
  tagName: string
  name?: string | null
  isDraft: boolean
  isPrerelease: boolean
  url: unknown
  createdAt: unknown
  publishedAt?: unknown
  tagCommit?: { oid: unknown } | null
}

function mapReleaseNode(r: ReleaseNode): ReleaseItemData {
  return {
    id: r.databaseId ?? null,
    tagName: r.tagName,
    name: r.name ?? null,
    isDraft: r.isDraft,
    isPrerelease: r.isPrerelease,
    url: r.url != null ? String(r.url) : null,
    targetCommitish: r.tagCommit?.oid != null ? String(r.tagCommit.oid) : null,
    createdAt: r.createdAt != null ? String(r.createdAt) : null,
    publishedAt: r.publishedAt != null ? String(r.publishedAt) : null,
  }
}

export async function runReleaseView(
  transport: GraphqlTransport,
  input: ReleaseViewInput,
): Promise<ReleaseViewData> {
  assertReleaseViewInput(input)
  const sdk = getReleaseViewSdk(createGraphqlRequestClient(transport))
  const result: ReleaseViewQuery = await sdk.ReleaseView(input)
  if (!result.repository?.release) {
    throw new Error("Release not found")
  }
  return mapReleaseNode(result.repository.release)
}

export async function runReleaseList(
  transport: GraphqlTransport,
  input: ReleaseListInput,
): Promise<ReleaseListData> {
  assertRepoAndPaginationInput(input)
  const sdk = getReleaseListSdk(createGraphqlRequestClient(transport))
  const result: ReleaseListQuery = await sdk.ReleaseList(input)
  if (!result.repository) {
    throw new Error(`Repository ${input.owner}/${input.name} not found`)
  }
  const conn = result.repository.releases
  return {
    items: (conn?.nodes ?? []).flatMap((n) => (n ? [mapReleaseNode(n)] : [])),
    pageInfo: {
      hasNextPage: conn?.pageInfo.hasNextPage ?? false,
      endCursor: conn?.pageInfo.endCursor ?? null,
    },
  }
}
