import {
  asRecord,
  assertIssueAssigneesAddInput,
  assertIssueAssigneesRemoveInput,
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
import { getSdk as getIssueAssigneesAddSdk } from "../operations/issue-assignees-add.generated.js"
import { getSdk as getIssueAssigneesLookupByNumberSdk } from "../operations/issue-assignees-lookup-by-number.generated.js"
import { getSdk as getIssueAssigneesRemoveSdk } from "../operations/issue-assignees-remove.generated.js"
import { getSdk as getIssueAssigneesUpdateSdk } from "../operations/issue-assignees-update.generated.js"
import { getSdk as getIssueBlockedByAddSdk } from "../operations/issue-blocked-by-add.generated.js"
import { getSdk as getIssueBlockedByRemoveSdk } from "../operations/issue-blocked-by-remove.generated.js"
import { getSdk as getIssueCloseSdk } from "../operations/issue-close.generated.js"
import { getSdk as getIssueCommentCreateSdk } from "../operations/issue-comment-create.generated.js"
import { getSdk as getIssueCreateSdk } from "../operations/issue-create.generated.js"
import { getSdk as getIssueCreateRepositoryIdSdk } from "../operations/issue-create-repository-id.generated.js"
import { getSdk as getIssueDeleteSdk } from "../operations/issue-delete.generated.js"
import { getSdk as getIssueLabelsAddSdk } from "../operations/issue-labels-add.generated.js"
import { getSdk as getIssueLabelsLookupByNumberSdk } from "../operations/issue-labels-lookup-by-number.generated.js"
import { getSdk as getIssueLabelsUpdateSdk } from "../operations/issue-labels-update.generated.js"
import { getSdk as getIssueLinkedPrsListSdk } from "../operations/issue-linked-prs-list.generated.js"
import { getSdk as getIssueMilestoneLookupSdk } from "../operations/issue-milestone-lookup.generated.js"
import { getSdk as getIssueMilestoneSetSdk } from "../operations/issue-milestone-set.generated.js"
import { getSdk as getIssueNodeIdLookupSdk } from "../operations/issue-node-id-lookup.generated.js"
import { getSdk as getIssueParentLookupSdk } from "../operations/issue-parent-lookup.generated.js"
import { getSdk as getIssueParentRemoveSdk } from "../operations/issue-parent-remove.generated.js"
import { getSdk as getIssueParentSetSdk } from "../operations/issue-parent-set.generated.js"
import { getSdk as getIssueRelationsGetSdk } from "../operations/issue-relations-get.generated.js"
import { getSdk as getIssueReopenSdk } from "../operations/issue-reopen.generated.js"
import { getSdk as getIssueUpdateSdk } from "../operations/issue-update.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { createGraphqlRequestClient } from "../transport.js"
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

  const client = createGraphqlRequestClient(transport)
  const lookupResult = await getIssueNodeIdLookupSdk(client).IssueNodeIdLookup({
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber,
  })

  const issueId = asRecord(asRecord(asRecord(lookupResult)?.repository)?.issue)?.id
  if (typeof issueId !== "string" || issueId.length === 0) {
    throw new Error("Issue not found")
  }

  const result = await getIssueUpdateSdk(client).IssueUpdate({
    issueId,
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

  const client = createGraphqlRequestClient(transport)
  const lookupResult = await getIssueNodeIdLookupSdk(client).IssueNodeIdLookup({
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber,
  })

  const issueId = asRecord(asRecord(asRecord(lookupResult)?.repository)?.issue)?.id
  if (typeof issueId !== "string" || issueId.length === 0) {
    throw new Error("Issue not found")
  }

  const result = await getIssueCloseSdk(client).IssueClose({ issueId })
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

  const client = createGraphqlRequestClient(transport)
  const lookupResult = await getIssueNodeIdLookupSdk(client).IssueNodeIdLookup({
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber,
  })

  const issueId = asRecord(asRecord(asRecord(lookupResult)?.repository)?.issue)?.id
  if (typeof issueId !== "string" || issueId.length === 0) {
    throw new Error("Issue not found")
  }

  const result = await getIssueReopenSdk(client).IssueReopen({ issueId })
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

  const client = createGraphqlRequestClient(transport)
  const lookupResult = await getIssueNodeIdLookupSdk(client).IssueNodeIdLookup({
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber,
  })

  const issueId = asRecord(asRecord(asRecord(lookupResult)?.repository)?.issue)?.id
  if (typeof issueId !== "string" || issueId.length === 0) {
    throw new Error("Issue not found")
  }

  const result = await getIssueDeleteSdk(client).IssueDelete({ issueId })
  const mutation = asRecord(asRecord(result)?.deleteIssue)
  if (!mutation) {
    throw new Error("Issue deletion failed")
  }

  return {
    id: issueId,
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
  const lookupResult = await getIssueLabelsLookupByNumberSdk(client).IssueLabelsLookupByNumber({
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber,
  })

  const repo = asRecord(asRecord(lookupResult)?.repository)
  const issueId = asRecord(repo?.issue)?.id
  if (typeof issueId !== "string" || issueId.length === 0) {
    throw new Error("Issue not found")
  }

  const availableLabels = Array.isArray(asRecord(repo?.labels)?.nodes)
    ? (asRecord(repo?.labels)?.nodes as unknown[])
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
    issueId,
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
  const lookupResult = await getIssueLabelsLookupByNumberSdk(client).IssueLabelsLookupByNumber({
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber,
  })

  const repo = asRecord(asRecord(lookupResult)?.repository)
  const labelableId = asRecord(repo?.issue)?.id
  if (typeof labelableId !== "string" || labelableId.length === 0) {
    throw new Error("Issue not found")
  }

  const availableLabels = Array.isArray(asRecord(repo?.labels)?.nodes)
    ? (asRecord(repo?.labels)?.nodes as unknown[])
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
    labelableId,
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
  const lookupResult = await getIssueAssigneesLookupByNumberSdk(
    client,
  ).IssueAssigneesLookupByNumber({
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber,
  })

  const { assignableId, assigneeIds } = resolveAssigneeIds(lookupResult, input.assignees)

  const result = await getIssueAssigneesUpdateSdk(client).IssueAssigneesUpdate({
    issueId: assignableId,
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

function resolveAssigneeIds(
  lookupResult: unknown,
  assigneeLogins: string[],
): { assignableId: string; assigneeIds: string[] } {
  const repo = asRecord(asRecord(lookupResult)?.repository)
  const issueId = asRecord(repo?.issue)?.id
  if (typeof issueId !== "string" || issueId.length === 0) {
    throw new Error("Issue not found")
  }

  const assignableNodes = Array.isArray(asRecord(repo?.assignableUsers)?.nodes)
    ? (asRecord(repo?.assignableUsers)?.nodes as unknown[])
    : []

  const idsByLogin = new Map<string, string>()
  for (const node of assignableNodes) {
    const rec = asRecord(node)
    if (typeof rec?.login === "string" && typeof rec?.id === "string") {
      idsByLogin.set(rec.login.toLowerCase(), rec.id)
    }
  }

  const assigneeIds = assigneeLogins.map((login) => {
    const id = idsByLogin.get(login.toLowerCase())
    if (!id) {
      throw new Error(`Assignee not found: ${login}`)
    }
    return id
  })

  return { assignableId: issueId, assigneeIds }
}

function parseAssignableResult(
  result: unknown,
  mutationKey: string,
): { id: string; assignees: string[] } {
  const mutation = asRecord(asRecord(result)?.[mutationKey])
  const assignable = asRecord(mutation?.assignable)
  const assignees = asRecord(assignable?.assignees)
  const nodes = Array.isArray(assignees?.nodes) ? assignees.nodes : []

  return {
    id: assertNonEmptyString(assignable?.id, "Issue id"),
    assignees: nodes
      .map((n) => asRecord(n)?.login)
      .filter((login): login is string => typeof login === "string"),
  }
}

export async function runIssueAssigneesAdd(
  transport: GraphqlTransport,
  input: IssueAssigneesAddInput,
): Promise<IssueAssigneesAddData> {
  assertIssueAssigneesAddInput(input)

  const client = createGraphqlRequestClient(transport)
  const lookupResult = await getIssueAssigneesLookupByNumberSdk(
    client,
  ).IssueAssigneesLookupByNumber({
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber,
  })

  const { assignableId, assigneeIds } = resolveAssigneeIds(lookupResult, input.assignees)

  const result = await getIssueAssigneesAddSdk(client).IssueAssigneesAdd({
    assignableId,
    assigneeIds,
  })

  return parseAssignableResult(result, "addAssigneesToAssignable")
}

export async function runIssueAssigneesRemove(
  transport: GraphqlTransport,
  input: IssueAssigneesRemoveInput,
): Promise<IssueAssigneesRemoveData> {
  assertIssueAssigneesRemoveInput(input)

  const client = createGraphqlRequestClient(transport)
  const lookupResult = await getIssueAssigneesLookupByNumberSdk(
    client,
  ).IssueAssigneesLookupByNumber({
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber,
  })

  const { assignableId, assigneeIds } = resolveAssigneeIds(lookupResult, input.assignees)

  const result = await getIssueAssigneesRemoveSdk(client).IssueAssigneesRemove({
    assignableId,
    assigneeIds,
  })

  return parseAssignableResult(result, "removeAssigneesFromAssignable")
}

export async function runIssueMilestoneSet(
  transport: GraphqlTransport,
  input: IssueMilestoneSetInput,
): Promise<IssueMilestoneSetData> {
  assertIssueMilestoneSetInput(input)

  const client = createGraphqlRequestClient(transport)
  const nodeLookupResult = await getIssueNodeIdLookupSdk(client).IssueNodeIdLookup({
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber,
  })

  const issueId = asRecord(asRecord(asRecord(nodeLookupResult)?.repository)?.issue)?.id
  if (typeof issueId !== "string" || issueId.length === 0) {
    throw new Error("Issue not found")
  }

  const milestoneLookupResult = await getIssueMilestoneLookupSdk(client).IssueMilestoneLookup({
    issueId,
    milestoneNumber: input.milestoneNumber,
  })

  const milestoneId = asRecord(
    asRecord(asRecord(asRecord(milestoneLookupResult)?.node)?.repository)?.milestone,
  )?.id
  if (typeof milestoneId !== "string" || milestoneId.length === 0) {
    throw new Error(`Milestone not found: ${input.milestoneNumber}`)
  }

  const result = await getIssueMilestoneSetSdk(client).IssueMilestoneSet({
    issueId,
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

  const client = createGraphqlRequestClient(transport)
  const lookupResult = await getIssueNodeIdLookupSdk(client).IssueNodeIdLookup({
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber,
  })

  const issueId = asRecord(asRecord(asRecord(lookupResult)?.repository)?.issue)?.id
  if (typeof issueId !== "string" || issueId.length === 0) {
    throw new Error("Issue not found")
  }

  const result = await getIssueCommentCreateSdk(client).IssueCommentCreate({
    issueId,
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
    updated: true,
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
    added: true,
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
