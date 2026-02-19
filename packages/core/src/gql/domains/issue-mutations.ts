import {
  asRecord,
  assertIssueAssigneesUpdateInput,
  assertIssueBlockedByInput,
  assertIssueCommentCreateInput,
  assertIssueCreateInput,
  assertIssueLabelsAddInput,
  assertIssueLabelsUpdateInput,
  assertIssueLinkedPrsListInput,
  assertIssueMilestoneSetInput,
  assertIssueMutationInput,
  assertIssueParentRemoveInput,
  assertIssueParentSetInput,
  assertIssueRelationsGetInput,
  assertIssueUpdateInput,
  assertNonEmptyString,
} from "../assertions.js"
import { getSdk as getIssueAssigneesLookupSdk } from "../operations/issue-assignees-lookup.generated.js"
import { getSdk as getIssueAssigneesUpdateSdk } from "../operations/issue-assignees-update.generated.js"
import { getSdk as getIssueBlockedByAddSdk } from "../operations/issue-blocked-by-add.generated.js"
import { getSdk as getIssueBlockedByRemoveSdk } from "../operations/issue-blocked-by-remove.generated.js"
import { getSdk as getIssueCloseSdk } from "../operations/issue-close.generated.js"
import { getSdk as getIssueCommentCreateSdk } from "../operations/issue-comment-create.generated.js"
import { getSdk as getIssueCreateSdk } from "../operations/issue-create.generated.js"
import { getSdk as getIssueCreateRepositoryIdSdk } from "../operations/issue-create-repository-id.generated.js"
import { getSdk as getIssueDeleteSdk } from "../operations/issue-delete.generated.js"
import { getSdk as getIssueLabelsAddSdk } from "../operations/issue-labels-add.generated.js"
import { getSdk as getIssueLabelsLookupSdk } from "../operations/issue-labels-lookup.generated.js"
import { getSdk as getIssueLabelsUpdateSdk } from "../operations/issue-labels-update.generated.js"
import { getSdk as getIssueLinkedPrsListSdk } from "../operations/issue-linked-prs-list.generated.js"
import { getSdk as getIssueMilestoneLookupSdk } from "../operations/issue-milestone-lookup.generated.js"
import { getSdk as getIssueMilestoneSetSdk } from "../operations/issue-milestone-set.generated.js"
import { getSdk as getIssueParentLookupSdk } from "../operations/issue-parent-lookup.generated.js"
import { getSdk as getIssueParentRemoveSdk } from "../operations/issue-parent-remove.generated.js"
import { getSdk as getIssueParentSetSdk } from "../operations/issue-parent-set.generated.js"
import { getSdk as getIssueRelationsGetSdk } from "../operations/issue-relations-get.generated.js"
import { getSdk as getIssueReopenSdk } from "../operations/issue-reopen.generated.js"
import { getSdk as getIssueUpdateSdk } from "../operations/issue-update.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { createGraphqlRequestClient } from "../transport.js"
import type {
  IssueAssigneesUpdateData,
  IssueAssigneesUpdateInput,
  IssueBlockedByData,
  IssueBlockedByInput,
  IssueCommentCreateData,
  IssueCommentCreateInput,
  IssueCreateInput,
  IssueLabelsAddData,
  IssueLabelsAddInput,
  IssueLabelsUpdateData,
  IssueLabelsUpdateInput,
  IssueLinkedPrsListData,
  IssueLinkedPrsListInput,
  IssueMilestoneSetData,
  IssueMilestoneSetInput,
  IssueMutationData,
  IssueMutationInput,
  IssueParentRemoveData,
  IssueParentRemoveInput,
  IssueParentSetData,
  IssueParentSetInput,
  IssueRelationNodeData,
  IssueRelationsGetData,
  IssueRelationsGetInput,
  IssueUpdateInput,
} from "../types.js"

function parseIssueNode(issue: unknown): IssueMutationData {
  const issueRecord = asRecord(issue)
  if (
    !issueRecord ||
    typeof issueRecord.id !== "string" ||
    typeof issueRecord.number !== "number"
  ) {
    throw new Error("Issue mutation failed")
  }

  const result: IssueMutationData = {
    id: issueRecord.id,
    number: issueRecord.number,
  }

  if (typeof issueRecord.title === "string") {
    result.title = issueRecord.title
  }
  if (typeof issueRecord.state === "string") {
    result.state = issueRecord.state
  }
  if (typeof issueRecord.url === "string") {
    result.url = issueRecord.url
  }

  return result
}

export async function runIssueCreate(
  transport: GraphqlTransport,
  input: IssueCreateInput,
): Promise<IssueMutationData> {
  assertIssueCreateInput(input)

  const client = createGraphqlRequestClient(transport)
  const repositoryLookupResult = await getIssueCreateRepositoryIdSdk(
    client,
  ).IssueCreateRepositoryId({
    owner: input.owner,
    name: input.name,
  })

  const repositoryId = asRecord(repositoryLookupResult.repository)?.id
  if (typeof repositoryId !== "string" || repositoryId.length === 0) {
    throw new Error("Repository not found")
  }

  const result = await getIssueCreateSdk(client).IssueCreate({
    repositoryId,
    title: input.title,
    ...(input.body === undefined ? {} : { body: input.body }),
  })

  const issue = asRecord(asRecord(result)?.createIssue)?.issue
  return parseIssueNode(issue)
}

export async function runIssueUpdate(
  transport: GraphqlTransport,
  input: IssueUpdateInput,
): Promise<IssueMutationData> {
  assertIssueUpdateInput(input)

  const result = await getIssueUpdateSdk(createGraphqlRequestClient(transport)).IssueUpdate({
    issueId: input.issueId,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.body === undefined ? {} : { body: input.body }),
  })
  const issue = asRecord(asRecord(result)?.updateIssue)?.issue
  return parseIssueNode(issue)
}

export async function runIssueClose(
  transport: GraphqlTransport,
  input: IssueMutationInput,
): Promise<IssueMutationData> {
  assertIssueMutationInput(input)

  const result = await getIssueCloseSdk(createGraphqlRequestClient(transport)).IssueClose({
    issueId: input.issueId,
  })
  const issueData = parseIssueNode(asRecord(asRecord(result)?.closeIssue)?.issue)
  return {
    ...issueData,
    closed: issueData.state === "CLOSED",
  }
}

export async function runIssueReopen(
  transport: GraphqlTransport,
  input: IssueMutationInput,
): Promise<IssueMutationData> {
  assertIssueMutationInput(input)

  const result = await getIssueReopenSdk(createGraphqlRequestClient(transport)).IssueReopen({
    issueId: input.issueId,
  })
  const issueData = parseIssueNode(asRecord(asRecord(result)?.reopenIssue)?.issue)
  return {
    ...issueData,
    reopened: issueData.state === "OPEN",
  }
}

export async function runIssueDelete(
  transport: GraphqlTransport,
  input: IssueMutationInput,
): Promise<IssueMutationData> {
  assertIssueMutationInput(input)

  const result = await getIssueDeleteSdk(createGraphqlRequestClient(transport)).IssueDelete({
    issueId: input.issueId,
  })
  const mutation = asRecord(asRecord(result)?.deleteIssue)
  if (!mutation) {
    throw new Error("Issue deletion failed")
  }

  return {
    id: input.issueId,
    number: 0,
    deleted: true,
  }
}

export async function runIssueLabelsUpdate(
  transport: GraphqlTransport,
  input: IssueLabelsUpdateInput,
): Promise<IssueLabelsUpdateData> {
  assertIssueLabelsUpdateInput(input)

  const client = createGraphqlRequestClient(transport)
  const lookupResult = await getIssueLabelsLookupSdk(client).IssueLabelsLookup({
    issueId: input.issueId,
  })

  const availableLabels = Array.isArray(
    asRecord(asRecord(asRecord(asRecord(lookupResult)?.node)?.repository)?.labels)?.nodes,
  )
    ? (asRecord(asRecord(asRecord(asRecord(lookupResult)?.node)?.repository)?.labels)
        ?.nodes as unknown[])
    : []

  const labelIdsByName = new Map<string, string>()
  for (const label of availableLabels) {
    const labelRecord = asRecord(label)
    if (typeof labelRecord?.name === "string" && typeof labelRecord?.id === "string") {
      labelIdsByName.set(labelRecord.name.toLowerCase(), labelRecord.id)
    }
  }

  const labelIds = input.labels.map((labelName) => {
    const id = labelIdsByName.get(labelName.toLowerCase())
    if (!id) {
      throw new Error(`Label not found: ${labelName}`)
    }
    return id
  })

  const result = await getIssueLabelsUpdateSdk(client).IssueLabelsUpdate({
    issueId: input.issueId,
    labelIds,
  })

  const mutation = asRecord(asRecord(result)?.["updateIssue"])
  const issue = asRecord(mutation?.["issue"])
  const labels = asRecord(issue?.["labels"])
  const labelNodes = Array.isArray(labels?.["nodes"]) ? labels["nodes"] : []

  return {
    id: assertNonEmptyString(issue?.["id"], "Issue id"),
    labels: labelNodes
      .map((label) => asRecord(label)?.["name"])
      .filter((name): name is string => typeof name === "string"),
  }
}

export async function runIssueLabelsAdd(
  transport: GraphqlTransport,
  input: IssueLabelsAddInput,
): Promise<IssueLabelsAddData> {
  assertIssueLabelsAddInput(input)

  const client = createGraphqlRequestClient(transport)
  const lookupResult = await getIssueLabelsLookupSdk(client).IssueLabelsLookup({
    issueId: input.issueId,
  })

  const availableLabels = Array.isArray(
    asRecord(asRecord(asRecord(asRecord(lookupResult)?.node)?.repository)?.labels)?.nodes,
  )
    ? (asRecord(asRecord(asRecord(asRecord(lookupResult)?.node)?.repository)?.labels)
        ?.nodes as unknown[])
    : []

  const labelIdsByName = new Map<string, string>()
  for (const label of availableLabels) {
    const labelRecord = asRecord(label)
    if (typeof labelRecord?.name === "string" && typeof labelRecord?.id === "string") {
      labelIdsByName.set(labelRecord.name.toLowerCase(), labelRecord.id)
    }
  }

  const labelIds = input.labels.map((labelName) => {
    const id = labelIdsByName.get(labelName.toLowerCase())
    if (!id) {
      throw new Error(`Label not found: ${labelName}`)
    }
    return id
  })

  const result = await getIssueLabelsAddSdk(client).IssueLabelsAdd({
    labelableId: input.issueId,
    labelIds,
  })

  const mutation = asRecord(asRecord(result)?.["addLabelsToLabelable"])
  const labelable = asRecord(mutation?.["labelable"])
  const labels = asRecord(labelable?.["labels"])
  const labelNodes = Array.isArray(labels?.["nodes"]) ? labels["nodes"] : []

  return {
    id: assertNonEmptyString(labelable?.["id"], "Issue id"),
    labels: labelNodes
      .map((label) => asRecord(label)?.["name"])
      .filter((name): name is string => typeof name === "string"),
  }
}

export async function runIssueAssigneesUpdate(
  transport: GraphqlTransport,
  input: IssueAssigneesUpdateInput,
): Promise<IssueAssigneesUpdateData> {
  assertIssueAssigneesUpdateInput(input)

  const client = createGraphqlRequestClient(transport)
  const lookupResult = await getIssueAssigneesLookupSdk(client).IssueAssigneesLookup({
    issueId: input.issueId,
  })

  const availableAssignees = Array.isArray(
    asRecord(asRecord(asRecord(asRecord(lookupResult)?.node)?.repository)?.assignableUsers)?.nodes,
  )
    ? (asRecord(asRecord(asRecord(asRecord(lookupResult)?.node)?.repository)?.assignableUsers)
        ?.nodes as unknown[])
    : []

  const assigneeIdsByLogin = new Map<string, string>()
  for (const assignee of availableAssignees) {
    const assigneeRecord = asRecord(assignee)
    if (typeof assigneeRecord?.login === "string" && typeof assigneeRecord?.id === "string") {
      assigneeIdsByLogin.set(assigneeRecord.login.toLowerCase(), assigneeRecord.id)
    }
  }

  const assigneeIds = input.assignees.map((login) => {
    const id = assigneeIdsByLogin.get(login.toLowerCase())
    if (!id) {
      throw new Error(`Assignee not found: ${login}`)
    }
    return id
  })

  const result = await getIssueAssigneesUpdateSdk(client).IssueAssigneesUpdate({
    issueId: input.issueId,
    assigneeIds,
  })

  const mutation = asRecord(asRecord(result)?.["updateIssue"])
  const issue = asRecord(mutation?.["issue"])
  const assignees = asRecord(issue?.["assignees"])
  const assigneeNodes = Array.isArray(assignees?.["nodes"]) ? assignees["nodes"] : []

  return {
    id: assertNonEmptyString(issue?.["id"], "Issue id"),
    assignees: assigneeNodes
      .map((assignee) => asRecord(assignee)?.["login"])
      .filter((login): login is string => typeof login === "string"),
  }
}

export async function runIssueMilestoneSet(
  transport: GraphqlTransport,
  input: IssueMilestoneSetInput,
): Promise<IssueMilestoneSetData> {
  assertIssueMilestoneSetInput(input)

  const client = createGraphqlRequestClient(transport)
  let milestoneId: string | null = null
  if (input.milestoneNumber !== null) {
    const lookupResult = await getIssueMilestoneLookupSdk(client).IssueMilestoneLookup({
      issueId: input.issueId,
      milestoneNumber: input.milestoneNumber,
    })

    const resolvedId = asRecord(
      asRecord(asRecord(asRecord(lookupResult)?.node)?.repository)?.milestone,
    )?.id
    if (typeof resolvedId !== "string" || resolvedId.length === 0) {
      throw new Error(`Milestone not found: ${input.milestoneNumber}`)
    }
    milestoneId = resolvedId
  }

  const result = await getIssueMilestoneSetSdk(client).IssueMilestoneSet({
    issueId: input.issueId,
    milestoneId,
  })

  const mutation = asRecord(asRecord(result)?.["updateIssue"])
  const issue = asRecord(mutation?.["issue"])
  const milestone = asRecord(issue?.["milestone"])

  return {
    id: assertNonEmptyString(issue?.["id"], "Issue id"),
    milestoneNumber: typeof milestone?.["number"] === "number" ? milestone["number"] : null,
  }
}

export async function runIssueCommentCreate(
  transport: GraphqlTransport,
  input: IssueCommentCreateInput,
): Promise<IssueCommentCreateData> {
  assertIssueCommentCreateInput(input)

  const result = await getIssueCommentCreateSdk(
    createGraphqlRequestClient(transport),
  ).IssueCommentCreate({
    issueId: input.issueId,
    body: input.body,
  })

  const mutation = asRecord(asRecord(result)?.["addComment"])
  const commentEdge = asRecord(mutation?.["commentEdge"])
  const node = asRecord(commentEdge?.["node"])
  if (!node || typeof node["id"] !== "string" || typeof node["body"] !== "string") {
    throw new Error("Issue comment creation failed")
  }

  return {
    id: node["id"],
    body: node["body"],
    url: typeof node["url"] === "string" ? node["url"] : "",
  }
}

export async function runIssueLinkedPrsList(
  transport: GraphqlTransport,
  input: IssueLinkedPrsListInput,
): Promise<IssueLinkedPrsListData> {
  assertIssueLinkedPrsListInput(input)

  const result = await getIssueLinkedPrsListSdk(
    createGraphqlRequestClient(transport),
  ).IssueLinkedPrsList({
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber,
  })

  const issue = asRecord(asRecord(asRecord(result)?.repository)?.issue)
  const timelineItems = asRecord(issue?.timelineItems)
  const nodes = Array.isArray(timelineItems?.nodes) ? timelineItems.nodes : []

  return {
    items: nodes
      .map((node) => asRecord(asRecord(node)?.["subject"]))
      .filter(
        (subject): subject is Record<string, unknown> =>
          Boolean(subject) && subject?.["__typename"] === "PullRequest",
      )
      .flatMap((subject) => {
        if (!subject) {
          return []
        }

        if (
          typeof subject["id"] !== "string" ||
          typeof subject["number"] !== "number" ||
          typeof subject["title"] !== "string" ||
          typeof subject["state"] !== "string" ||
          typeof subject["url"] !== "string"
        ) {
          return []
        }

        return [
          {
            id: subject["id"],
            number: subject["number"],
            title: subject["title"],
            state: subject["state"],
            url: subject["url"],
          },
        ]
      }),
  }
}

function parseIssueRelationNode(node: unknown): IssueRelationNodeData | null {
  const record = asRecord(node)
  if (!record || typeof record.id !== "string" || typeof record.number !== "number") {
    return null
  }

  return {
    id: record.id,
    number: record.number,
  }
}

export async function runIssueRelationsGet(
  transport: GraphqlTransport,
  input: IssueRelationsGetInput,
): Promise<IssueRelationsGetData> {
  assertIssueRelationsGetInput(input)

  const result = await getIssueRelationsGetSdk(
    createGraphqlRequestClient(transport),
  ).IssueRelationsGet({
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber,
  })

  const issue = asRecord(asRecord(asRecord(result)?.repository)?.issue)
  const currentIssue = parseIssueRelationNode(issue)
  if (!currentIssue) {
    throw new Error("Issue relations not found")
  }

  const parent = parseIssueRelationNode(issue?.parent)
  const subIssues = asRecord(issue?.["subIssues"])
  const blockedByConnection = asRecord(issue?.["blockedBy"])
  const childrenNodes = Array.isArray(subIssues?.["nodes"]) ? subIssues["nodes"] : []
  const blockedByNodes = Array.isArray(blockedByConnection?.["nodes"])
    ? blockedByConnection["nodes"]
    : []

  return {
    issue: currentIssue,
    parent,
    children: childrenNodes
      .map((node) => parseIssueRelationNode(node))
      .flatMap((node) => (node ? [node] : [])),
    blockedBy: blockedByNodes
      .map((node) => parseIssueRelationNode(node))
      .flatMap((node) => (node ? [node] : [])),
  }
}

export async function runIssueParentSet(
  transport: GraphqlTransport,
  input: IssueParentSetInput,
): Promise<IssueParentSetData> {
  assertIssueParentSetInput(input)

  const result = await getIssueParentSetSdk(createGraphqlRequestClient(transport)).IssueParentSet({
    issueId: input.issueId,
    parentIssueId: input.parentIssueId,
  })

  const mutation = asRecord(asRecord(result)?.addSubIssue)
  const parentIssue = asRecord(mutation?.issue)
  const subIssue = asRecord(mutation?.subIssue)
  if (typeof parentIssue?.id !== "string" || typeof subIssue?.id !== "string") {
    throw new Error("Issue parent update failed")
  }

  return {
    issueId: subIssue.id,
    parentIssueId: parentIssue.id,
  }
}

export async function runIssueParentRemove(
  transport: GraphqlTransport,
  input: IssueParentRemoveInput,
): Promise<IssueParentRemoveData> {
  assertIssueParentRemoveInput(input)

  const client = createGraphqlRequestClient(transport)
  const lookupResult = await getIssueParentLookupSdk(client).IssueParentLookup({
    issueId: input.issueId,
  })

  const parentIssueId = asRecord(asRecord(asRecord(lookupResult)?.node)?.parent)?.id
  if (typeof parentIssueId !== "string" || parentIssueId.length === 0) {
    throw new Error("Issue parent removal failed")
  }

  const result = await getIssueParentRemoveSdk(client).IssueParentRemove({
    issueId: input.issueId,
    parentIssueId,
  })

  const mutation = asRecord(asRecord(result)?.removeSubIssue)
  const parentIssue = asRecord(mutation?.issue)
  const subIssue = asRecord(mutation?.subIssue)
  if (typeof parentIssue?.id !== "string" || typeof subIssue?.id !== "string") {
    throw new Error("Issue parent removal failed")
  }

  return {
    issueId: subIssue.id,
    parentRemoved: true,
  }
}

export async function runIssueBlockedByAdd(
  transport: GraphqlTransport,
  input: IssueBlockedByInput,
): Promise<IssueBlockedByData> {
  assertIssueBlockedByInput(input)

  const result = await getIssueBlockedByAddSdk(
    createGraphqlRequestClient(transport),
  ).IssueBlockedByAdd({
    issueId: input.issueId,
    blockedByIssueId: input.blockedByIssueId,
  })

  const mutation = asRecord(asRecord(result)?.addBlockedBy)
  const issue = asRecord(mutation?.issue)
  const blockingIssue = asRecord(mutation?.blockingIssue)
  if (typeof issue?.id !== "string" || typeof blockingIssue?.id !== "string") {
    throw new Error("Issue dependency mutation failed")
  }

  return {
    issueId: issue.id,
    blockedByIssueId: blockingIssue.id,
  }
}

export async function runIssueBlockedByRemove(
  transport: GraphqlTransport,
  input: IssueBlockedByInput,
): Promise<IssueBlockedByData> {
  assertIssueBlockedByInput(input)

  const result = await getIssueBlockedByRemoveSdk(
    createGraphqlRequestClient(transport),
  ).IssueBlockedByRemove({
    issueId: input.issueId,
    blockedByIssueId: input.blockedByIssueId,
  })

  const mutation = asRecord(asRecord(result)?.removeBlockedBy)
  const issue = asRecord(mutation?.issue)
  const blockingIssue = asRecord(mutation?.blockingIssue)
  if (typeof issue?.id !== "string" || typeof blockingIssue?.id !== "string") {
    throw new Error("Issue dependency mutation failed")
  }

  return {
    issueId: issue.id,
    blockedByIssueId: blockingIssue.id,
    removed: true,
  }
}
