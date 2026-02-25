import type { OperationCard } from "@core/core/registry/types.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { vi } from "vitest"

export const baseCard: OperationCard = {
  capability_id: "repo.view",
  version: "1.0.0",
  description: "Fetch repository",
  input_schema: { type: "object" },
  output_schema: { type: "object" },
  routing: {
    preferred: "graphql",
    fallbacks: ["cli"],
  },
}

export function createGithubClient(overrides?: Partial<GithubClient>): GithubClient {
  return {
    fetchRepoView: vi.fn(),
    fetchIssueCommentsList: vi.fn(),
    fetchIssueList: vi.fn(),
    fetchIssueView: vi.fn(),
    fetchPrList: vi.fn(),
    fetchPrView: vi.fn(),
    fetchPrCommentsList: vi.fn(),
    fetchPrReviewsList: vi.fn(),
    fetchPrDiffListFiles: vi.fn(),
    fetchPrMergeStatus: vi.fn(),
    replyToReviewThread: vi.fn(),
    resolveReviewThread: vi.fn(),
    unresolveReviewThread: vi.fn(),
    submitPrReview: vi.fn(),
    query: vi.fn(),
    queryRaw: vi.fn().mockResolvedValue({ data: {}, errors: undefined }),
    ...overrides,
  } as unknown as GithubClient
}
