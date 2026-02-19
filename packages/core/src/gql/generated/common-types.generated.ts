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

// Keep enums lightweight for operation result typing.
export type IssueState = string
export type PullRequestState = string
export type DiffSide = string
export type PullRequestReviewThreadSubjectType = string
export type PullRequestReviewState = string
export type MergeableState = string
export type MergeStateStatus = string
export type PullRequestReviewDecision = string
