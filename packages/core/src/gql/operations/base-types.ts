export type Maybe<T> = T | null
export type InputMaybe<T> = Maybe<T>
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }

export type Scalars = {
  String: { input: string; output: string }
  Int: { input: number; output: number }
  Boolean: { input: boolean; output: boolean }
  ID: { input: string; output: string }
  URI: { input: unknown; output: unknown }
}

// Keep enum-like GraphQL values lightweight for operation result typing.
export type IssueState = string
export type PullRequestState = string
export type DiffSide = string
export type PullRequestReviewThreadSubjectType = string
export type PullRequestReviewState = string
export type PullRequestReviewEvent = string
export type MergeableState = string
export type MergeStateStatus = string
export type PullRequestReviewDecision = string
export type ProjectV2FieldType = string
export type ProjectV2ItemType = string
export type IssueTypeColor = string
export type PullRequestMergeMethod = string
export type PullRequestBranchUpdateMethod = string
export type ProjectV2FieldValue = Record<string, unknown>

export type DraftPullRequestReviewThread = {
  body: Scalars["String"]["input"]
  line?: InputMaybe<Scalars["Int"]["input"]>
  path?: InputMaybe<Scalars["String"]["input"]>
  side?: InputMaybe<DiffSide>
  startLine?: InputMaybe<Scalars["Int"]["input"]>
  startSide?: InputMaybe<DiffSide>
}
