import type { GraphqlClient, GraphqlTransport, TokenClientOptions } from "./transport.js"
import { createGraphqlClient, createTokenTransport } from "./transport.js"
import type {
  IssueAssigneesUpdateData,
  IssueAssigneesUpdateInput,
  IssueBlockedByData,
  IssueBlockedByInput,
  IssueCommentCreateData,
  IssueCommentCreateInput,
  IssueCommentsListData,
  IssueCommentsListInput,
  IssueCreateInput,
  IssueLabelsAddData,
  IssueLabelsAddInput,
  IssueLabelsUpdateData,
  IssueLabelsUpdateInput,
  IssueLinkedPrsListData,
  IssueLinkedPrsListInput,
  IssueListData,
  IssueListInput,
  IssueMilestoneSetData,
  IssueMilestoneSetInput,
  IssueMutationData,
  IssueMutationInput,
  IssueParentRemoveData,
  IssueParentRemoveInput,
  IssueParentSetData,
  IssueParentSetInput,
  IssueRelationsGetData,
  IssueRelationsGetInput,
  IssueUpdateInput,
  IssueViewData,
  IssueViewInput,
  PrCommentsListData,
  PrCommentsListInput,
  PrDiffListFilesData,
  PrDiffListFilesInput,
  PrListData,
  PrListInput,
  PrMergeStatusData,
  PrMergeStatusInput,
  PrReviewSubmitData,
  PrReviewSubmitInput,
  PrReviewsListData,
  PrReviewsListInput,
  PrViewData,
  PrViewInput,
  ReplyToReviewThreadInput,
  RepoViewData,
  RepoViewInput,
  ReviewThreadMutationData,
  ReviewThreadMutationInput,
} from "./types.js"

export interface GithubClient extends GraphqlClient {
  fetchRepoView(input: RepoViewInput): Promise<RepoViewData>
  fetchIssueCommentsList(input: IssueCommentsListInput): Promise<IssueCommentsListData>
  createIssue(input: IssueCreateInput): Promise<IssueMutationData>
  updateIssue(input: IssueUpdateInput): Promise<IssueMutationData>
  closeIssue(input: IssueMutationInput): Promise<IssueMutationData>
  reopenIssue(input: IssueMutationInput): Promise<IssueMutationData>
  deleteIssue(input: IssueMutationInput): Promise<IssueMutationData>
  updateIssueLabels(input: IssueLabelsUpdateInput): Promise<IssueLabelsUpdateData>
  addIssueLabels(input: IssueLabelsAddInput): Promise<IssueLabelsAddData>
  updateIssueAssignees(input: IssueAssigneesUpdateInput): Promise<IssueAssigneesUpdateData>
  setIssueMilestone(input: IssueMilestoneSetInput): Promise<IssueMilestoneSetData>
  createIssueComment(input: IssueCommentCreateInput): Promise<IssueCommentCreateData>
  fetchIssueLinkedPrs(input: IssueLinkedPrsListInput): Promise<IssueLinkedPrsListData>
  fetchIssueRelations(input: IssueRelationsGetInput): Promise<IssueRelationsGetData>
  setIssueParent(input: IssueParentSetInput): Promise<IssueParentSetData>
  removeIssueParent(input: IssueParentRemoveInput): Promise<IssueParentRemoveData>
  addIssueBlockedBy(input: IssueBlockedByInput): Promise<IssueBlockedByData>
  removeIssueBlockedBy(input: IssueBlockedByInput): Promise<IssueBlockedByData>
  fetchIssueList(input: IssueListInput): Promise<IssueListData>
  fetchIssueView(input: IssueViewInput): Promise<IssueViewData>
  fetchPrList(input: PrListInput): Promise<PrListData>
  fetchPrView(input: PrViewInput): Promise<PrViewData>
  fetchPrCommentsList(input: PrCommentsListInput): Promise<PrCommentsListData>
  fetchPrReviewsList(input: PrReviewsListInput): Promise<PrReviewsListData>
  fetchPrDiffListFiles(input: PrDiffListFilesInput): Promise<PrDiffListFilesData>
  fetchPrMergeStatus(input: PrMergeStatusInput): Promise<PrMergeStatusData>
  replyToReviewThread(input: ReplyToReviewThreadInput): Promise<ReviewThreadMutationData>
  resolveReviewThread(input: ReviewThreadMutationInput): Promise<ReviewThreadMutationData>
  unresolveReviewThread(input: ReviewThreadMutationInput): Promise<ReviewThreadMutationData>
  submitPrReview(input: PrReviewSubmitInput): Promise<PrReviewSubmitData>
}

export function createGithubClientFromToken(
  tokenOrOptions: string | TokenClientOptions,
): GithubClient {
  const token = typeof tokenOrOptions === "string" ? tokenOrOptions : tokenOrOptions.token
  const graphqlUrl = typeof tokenOrOptions === "string" ? undefined : tokenOrOptions.graphqlUrl

  if (!token || token.trim().length === 0) {
    throw new Error("GitHub token is required")
  }

  return createGithubClient(createTokenTransport(token, graphqlUrl))
}

export function createGithubClient(transport: GraphqlTransport): GithubClient {
  const graphqlClient = createGraphqlClient(transport)

  let repo: typeof import("./domains/repo.js") | undefined
  let issueQueries: typeof import("./domains/issue-queries.js") | undefined
  let issueMutations: typeof import("./domains/issue-mutations.js") | undefined
  let prQueries: typeof import("./domains/pr-queries.js") | undefined
  let prMutations: typeof import("./domains/pr-mutations.js") | undefined

  const loadRepo = async () => (repo ??= await import("./domains/repo.js"))
  const loadIssueQueries = async () => (issueQueries ??= await import("./domains/issue-queries.js"))
  const loadIssueMutations = async () =>
    (issueMutations ??= await import("./domains/issue-mutations.js"))
  const loadPrQueries = async () => (prQueries ??= await import("./domains/pr-queries.js"))
  const loadPrMutations = async () => (prMutations ??= await import("./domains/pr-mutations.js"))

  return {
    query: (query, variables) => graphqlClient.query(query, variables),
    fetchRepoView: async (input) => (await loadRepo()).runRepoView(transport, input),
    fetchIssueView: async (input) => (await loadIssueQueries()).runIssueView(transport, input),
    fetchIssueList: async (input) => (await loadIssueQueries()).runIssueList(transport, input),
    fetchIssueCommentsList: async (input) =>
      (await loadIssueQueries()).runIssueCommentsList(transport, input),
    createIssue: async (input) => (await loadIssueMutations()).runIssueCreate(transport, input),
    updateIssue: async (input) => (await loadIssueMutations()).runIssueUpdate(transport, input),
    closeIssue: async (input) => (await loadIssueMutations()).runIssueClose(transport, input),
    reopenIssue: async (input) => (await loadIssueMutations()).runIssueReopen(transport, input),
    deleteIssue: async (input) => (await loadIssueMutations()).runIssueDelete(transport, input),
    updateIssueLabels: async (input) =>
      (await loadIssueMutations()).runIssueLabelsUpdate(transport, input),
    addIssueLabels: async (input) =>
      (await loadIssueMutations()).runIssueLabelsAdd(transport, input),
    updateIssueAssignees: async (input) =>
      (await loadIssueMutations()).runIssueAssigneesUpdate(transport, input),
    setIssueMilestone: async (input) =>
      (await loadIssueMutations()).runIssueMilestoneSet(transport, input),
    createIssueComment: async (input) =>
      (await loadIssueMutations()).runIssueCommentCreate(transport, input),
    fetchIssueLinkedPrs: async (input) =>
      (await loadIssueMutations()).runIssueLinkedPrsList(transport, input),
    fetchIssueRelations: async (input) =>
      (await loadIssueMutations()).runIssueRelationsGet(transport, input),
    setIssueParent: async (input) =>
      (await loadIssueMutations()).runIssueParentSet(transport, input),
    removeIssueParent: async (input) =>
      (await loadIssueMutations()).runIssueParentRemove(transport, input),
    addIssueBlockedBy: async (input) =>
      (await loadIssueMutations()).runIssueBlockedByAdd(transport, input),
    removeIssueBlockedBy: async (input) =>
      (await loadIssueMutations()).runIssueBlockedByRemove(transport, input),
    fetchPrView: async (input) => (await loadPrQueries()).runPrView(transport, input),
    fetchPrList: async (input) => (await loadPrQueries()).runPrList(transport, input),
    fetchPrReviewsList: async (input) => (await loadPrQueries()).runPrReviewsList(transport, input),
    fetchPrDiffListFiles: async (input) =>
      (await loadPrQueries()).runPrDiffListFiles(transport, input),
    fetchPrMergeStatus: async (input) => (await loadPrQueries()).runPrMergeStatus(transport, input),
    fetchPrCommentsList: async (input) =>
      (await loadPrMutations()).runPrCommentsList(transport, input),
    replyToReviewThread: async (input) =>
      (await loadPrMutations()).runReplyToReviewThread(transport, input),
    resolveReviewThread: async (input) =>
      (await loadPrMutations()).runResolveReviewThread(transport, input),
    unresolveReviewThread: async (input) =>
      (await loadPrMutations()).runUnresolveReviewThread(transport, input),
    submitPrReview: async (input) => (await loadPrMutations()).runSubmitPrReview(transport, input),
  }
}
