import type { GraphqlClient, GraphqlTransport, TokenClientOptions } from "./transport.js"
import { createGraphqlClient, createTokenTransport } from "./transport.js"
import type {
  IssueAssigneesAddData,
  IssueAssigneesAddInput,
  IssueAssigneesRemoveData,
  IssueAssigneesRemoveInput,
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
  IssueLabelsRemoveData,
  IssueLabelsRemoveInput,
  IssueLabelsUpdateData,
  IssueLabelsUpdateInput,
  IssueLinkedPrsListData,
  IssueLinkedPrsListInput,
  IssueListData,
  IssueListInput,
  IssueMilestoneClearData,
  IssueMilestoneClearInput,
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
  PrAssigneesAddData,
  PrAssigneesAddInput,
  PrAssigneesRemoveData,
  PrAssigneesRemoveInput,
  PrBranchUpdateData,
  PrBranchUpdateInput,
  PrCommentsListData,
  PrCommentsListInput,
  PrCreateData,
  PrCreateInput,
  PrDiffListFilesData,
  PrDiffListFilesInput,
  PrListData,
  PrListInput,
  PrMergeData,
  PrMergeInput,
  PrMergeStatusData,
  PrMergeStatusInput,
  ProjectV2FieldsListData,
  ProjectV2FieldsListInput,
  ProjectV2ItemAddData,
  ProjectV2ItemAddInput,
  ProjectV2ItemFieldUpdateData,
  ProjectV2ItemFieldUpdateInput,
  ProjectV2ItemRemoveData,
  ProjectV2ItemRemoveInput,
  ProjectV2ItemsListData,
  ProjectV2ItemsListInput,
  ProjectV2OrgViewData,
  ProjectV2OrgViewInput,
  ProjectV2UserViewData,
  ProjectV2UserViewInput,
  PrReviewSubmitData,
  PrReviewSubmitInput,
  PrReviewsListData,
  PrReviewsListInput,
  PrReviewsRequestData,
  PrReviewsRequestInput,
  PrUpdateData,
  PrUpdateInput,
  PrViewData,
  PrViewInput,
  ReleaseListData,
  ReleaseListInput,
  ReleaseViewData,
  ReleaseViewInput,
  ReplyToReviewThreadInput,
  RepoIssueTypesListData,
  RepoIssueTypesListInput,
  RepoLabelsListData,
  RepoLabelsListInput,
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
  removeIssueLabels(input: IssueLabelsRemoveInput): Promise<IssueLabelsRemoveData>
  updateIssueAssignees(input: IssueAssigneesUpdateInput): Promise<IssueAssigneesUpdateData>
  addIssueAssignees(input: IssueAssigneesAddInput): Promise<IssueAssigneesAddData>
  removeIssueAssignees(input: IssueAssigneesRemoveInput): Promise<IssueAssigneesRemoveData>
  setIssueMilestone(input: IssueMilestoneSetInput): Promise<IssueMilestoneSetData>
  clearIssueMilestone(input: IssueMilestoneClearInput): Promise<IssueMilestoneClearData>
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
  fetchRepoLabelsList(input: RepoLabelsListInput): Promise<RepoLabelsListData>
  fetchRepoIssueTypesList(input: RepoIssueTypesListInput): Promise<RepoIssueTypesListData>
  fetchReleaseView(input: ReleaseViewInput): Promise<ReleaseViewData>
  fetchReleaseList(input: ReleaseListInput): Promise<ReleaseListData>
  fetchProjectV2OrgView(input: ProjectV2OrgViewInput): Promise<ProjectV2OrgViewData>
  fetchProjectV2UserView(input: ProjectV2UserViewInput): Promise<ProjectV2UserViewData>
  fetchProjectV2FieldsList(input: ProjectV2FieldsListInput): Promise<ProjectV2FieldsListData>
  fetchProjectV2ItemsList(input: ProjectV2ItemsListInput): Promise<ProjectV2ItemsListData>
  createPr(input: PrCreateInput): Promise<PrCreateData>
  updatePr(input: PrUpdateInput): Promise<PrUpdateData>
  mergePr(input: PrMergeInput): Promise<PrMergeData>
  updatePrBranch(input: PrBranchUpdateInput): Promise<PrBranchUpdateData>
  addPrAssignees(input: PrAssigneesAddInput): Promise<PrAssigneesAddData>
  removePrAssignees(input: PrAssigneesRemoveInput): Promise<PrAssigneesRemoveData>
  requestPrReviews(input: PrReviewsRequestInput): Promise<PrReviewsRequestData>
  addProjectV2Item(input: ProjectV2ItemAddInput): Promise<ProjectV2ItemAddData>
  removeProjectV2Item(input: ProjectV2ItemRemoveInput): Promise<ProjectV2ItemRemoveData>
  updateProjectV2ItemField(
    input: ProjectV2ItemFieldUpdateInput,
  ): Promise<ProjectV2ItemFieldUpdateData>
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
  let release: typeof import("./domains/release.js") | undefined
  let project: typeof import("./domains/project.js") | undefined

  const loadRepo = async () => (repo ??= await import("./domains/repo.js"))
  const loadIssueQueries = async () => (issueQueries ??= await import("./domains/issue-queries.js"))
  const loadIssueMutations = async () =>
    (issueMutations ??= await import("./domains/issue-mutations.js"))
  const loadPrQueries = async () => (prQueries ??= await import("./domains/pr-queries.js"))
  const loadPrMutations = async () => (prMutations ??= await import("./domains/pr-mutations.js"))
  const loadRelease = async () => (release ??= await import("./domains/release.js"))
  const loadProject = async () => (project ??= await import("./domains/project.js"))

  return {
    query: (query, variables) => graphqlClient.query(query, variables),
    queryRaw: (query, variables) => graphqlClient.queryRaw(query, variables),
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
    removeIssueLabels: async (input) =>
      (await loadIssueMutations()).runIssueLabelsRemove(transport, input),
    updateIssueAssignees: async (input) =>
      (await loadIssueMutations()).runIssueAssigneesUpdate(transport, input),
    addIssueAssignees: async (input) =>
      (await loadIssueMutations()).runIssueAssigneesAdd(transport, input),
    removeIssueAssignees: async (input) =>
      (await loadIssueMutations()).runIssueAssigneesRemove(transport, input),
    setIssueMilestone: async (input) =>
      (await loadIssueMutations()).runIssueMilestoneSet(transport, input),
    clearIssueMilestone: async (input) =>
      (await loadIssueMutations()).runIssueMilestoneClear(transport, input),
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
    fetchRepoLabelsList: async (input) => (await loadRepo()).runRepoLabelsList(transport, input),
    fetchRepoIssueTypesList: async (input) =>
      (await loadRepo()).runRepoIssueTypesList(transport, input),
    fetchReleaseView: async (input) => (await loadRelease()).runReleaseView(transport, input),
    fetchReleaseList: async (input) => (await loadRelease()).runReleaseList(transport, input),
    fetchProjectV2OrgView: async (input) =>
      (await loadProject()).runProjectV2OrgView(transport, input),
    fetchProjectV2UserView: async (input) =>
      (await loadProject()).runProjectV2UserView(transport, input),
    fetchProjectV2FieldsList: async (input) =>
      (await loadProject()).runProjectV2FieldsList(transport, input),
    fetchProjectV2ItemsList: async (input) =>
      (await loadProject()).runProjectV2ItemsList(transport, input),
    createPr: async (input) => (await loadPrMutations()).runPrCreate(transport, input),
    updatePr: async (input) => (await loadPrMutations()).runPrUpdate(transport, input),
    mergePr: async (input) => (await loadPrMutations()).runPrMerge(transport, input),
    updatePrBranch: async (input) => (await loadPrMutations()).runPrBranchUpdate(transport, input),
    addPrAssignees: async (input) => (await loadPrMutations()).runPrAssigneesAdd(transport, input),
    removePrAssignees: async (input) =>
      (await loadPrMutations()).runPrAssigneesRemove(transport, input),
    requestPrReviews: async (input) =>
      (await loadPrMutations()).runPrReviewsRequest(transport, input),
    addProjectV2Item: async (input) => (await loadProject()).runProjectV2ItemAdd(transport, input),
    removeProjectV2Item: async (input) =>
      (await loadProject()).runProjectV2ItemRemove(transport, input),
    updateProjectV2ItemField: async (input) =>
      (await loadProject()).runProjectV2ItemFieldUpdate(transport, input),
  }
}
