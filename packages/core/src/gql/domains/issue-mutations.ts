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
import type { GraphqlClient, GraphqlVariables } from "../transport.js"
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

const ISSUE_CREATE_REPOSITORY_ID_QUERY = `
  query IssueCreateRepositoryId($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
    }
  }
`

const ISSUE_CREATE_MUTATION = `
  mutation IssueCreate($repositoryId: ID!, $title: String!, $body: String) {
    createIssue(input: { repositoryId: $repositoryId, title: $title, body: $body }) {
      issue {
        id
        number
        title
        state
        url
      }
    }
  }
`

const ISSUE_UPDATE_MUTATION = `
  mutation IssueUpdate($issueId: ID!, $title: String, $body: String) {
    updateIssue(input: { id: $issueId, title: $title, body: $body }) {
      issue {
        id
        number
        title
        state
        url
      }
    }
  }
`

const ISSUE_CLOSE_MUTATION = `
  mutation IssueClose($issueId: ID!) {
    closeIssue(input: { issueId: $issueId }) {
      issue {
        id
        number
        state
      }
    }
  }
`

const ISSUE_REOPEN_MUTATION = `
  mutation IssueReopen($issueId: ID!) {
    reopenIssue(input: { issueId: $issueId }) {
      issue {
        id
        number
        state
      }
    }
  }
`

const ISSUE_DELETE_MUTATION = `
  mutation IssueDelete($issueId: ID!) {
    deleteIssue(input: { issueId: $issueId }) {
      clientMutationId
    }
  }
`

const ISSUE_LABELS_UPDATE_MUTATION = `
  mutation IssueLabelsUpdate($issueId: ID!, $labelIds: [ID!]!) {
    updateIssue(input: { id: $issueId, labelIds: $labelIds }) {
      issue {
        id
        labels(first: 50) {
          nodes {
            name
          }
        }
      }
    }
  }
`

const ISSUE_LABELS_ADD_MUTATION = `
  mutation IssueLabelsAdd($labelableId: ID!, $labelIds: [ID!]!) {
    addLabelsToLabelable(input: { labelableId: $labelableId, labelIds: $labelIds }) {
      labelable {
        ... on Issue {
          id
          labels(first: 50) {
            nodes {
              name
            }
          }
        }
      }
    }
  }
`

const ISSUE_ASSIGNEES_UPDATE_MUTATION = `
  mutation IssueAssigneesUpdate($issueId: ID!, $assigneeIds: [ID!]!) {
    updateIssue(input: { id: $issueId, assigneeIds: $assigneeIds }) {
      issue {
        id
        assignees(first: 50) {
          nodes {
            login
          }
        }
      }
    }
  }
`

const ISSUE_MILESTONE_SET_MUTATION = `
  mutation IssueMilestoneSet($issueId: ID!, $milestoneId: ID) {
    updateIssue(input: { id: $issueId, milestoneId: $milestoneId }) {
      issue {
        id
        milestone {
          number
        }
      }
    }
  }
`

const ISSUE_LABELS_LOOKUP_QUERY = `
  query IssueLabelsLookup($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        repository {
          labels(first: 100) {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  }
`

const ISSUE_ASSIGNEES_LOOKUP_QUERY = `
  query IssueAssigneesLookup($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        repository {
          assignableUsers(first: 100) {
            nodes {
              id
              login
            }
          }
        }
      }
    }
  }
`

const ISSUE_MILESTONE_LOOKUP_QUERY = `
  query IssueMilestoneLookup($issueId: ID!, $milestoneNumber: Int!) {
    node(id: $issueId) {
      ... on Issue {
        repository {
          milestone(number: $milestoneNumber) {
            id
          }
        }
      }
    }
  }
`

const ISSUE_COMMENT_CREATE_MUTATION = `
  mutation IssueCommentCreate($issueId: ID!, $body: String!) {
    addComment(input: { subjectId: $issueId, body: $body }) {
      commentEdge {
        node {
          id
          body
          url
        }
      }
    }
  }
`

const ISSUE_LINKED_PRS_LIST_QUERY = `
  query IssueLinkedPrsList($owner: String!, $name: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $name) {
      issue(number: $issueNumber) {
        timelineItems(first: 50, itemTypes: [CONNECTED_EVENT]) {
          nodes {
            __typename
            ... on ConnectedEvent {
              subject {
                __typename
                ... on PullRequest {
                  id
                  number
                  title
                  state
                  url
                }
              }
            }
          }
        }
      }
    }
  }
`

const ISSUE_RELATIONS_GET_QUERY = `
  query IssueRelationsGet($owner: String!, $name: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $name) {
      issue(number: $issueNumber) {
        id
        number
        parent {
          id
          number
        }
        subIssues(first: 50) {
          nodes {
            id
            number
          }
        }
        blockedBy(first: 50) {
          nodes {
            id
            number
          }
        }
      }
    }
  }
`

const ISSUE_PARENT_LOOKUP_QUERY = `
  query IssueParentLookup($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        id
        parent {
          id
        }
      }
    }
  }
`

const ISSUE_PARENT_SET_MUTATION = `
  mutation IssueParentSet($issueId: ID!, $parentIssueId: ID!) {
    addSubIssue(input: { issueId: $parentIssueId, subIssueId: $issueId }) {
      issue { id }
      subIssue { id }
    }
  }
`

const ISSUE_PARENT_REMOVE_MUTATION = `
  mutation IssueParentRemove($issueId: ID!, $parentIssueId: ID!) {
    removeSubIssue(input: { issueId: $parentIssueId, subIssueId: $issueId }) {
      issue { id }
      subIssue { id }
    }
  }
`

const ISSUE_BLOCKED_BY_ADD_MUTATION = `
  mutation IssueBlockedByAdd($issueId: ID!, $blockedByIssueId: ID!) {
    addBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockedByIssueId }) {
      issue { id }
      blockingIssue { id }
    }
  }
`

const ISSUE_BLOCKED_BY_REMOVE_MUTATION = `
  mutation IssueBlockedByRemove($issueId: ID!, $blockedByIssueId: ID!) {
    removeBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockedByIssueId }) {
      issue { id }
      blockingIssue { id }
    }
  }
`

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
  graphqlClient: GraphqlClient,
  input: IssueCreateInput,
): Promise<IssueMutationData> {
  assertIssueCreateInput(input)

  const repositoryLookupResult = await graphqlClient.query<unknown, GraphqlVariables>(
    ISSUE_CREATE_REPOSITORY_ID_QUERY,
    {
      owner: input.owner,
      name: input.name,
    },
  )
  const repositoryId = asRecord(asRecord(repositoryLookupResult)?.repository)?.id
  if (typeof repositoryId !== "string" || repositoryId.length === 0) {
    throw new Error("Repository not found")
  }

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_CREATE_MUTATION, {
    repositoryId,
    title: input.title,
    body: input.body,
  })
  const issue = asRecord(asRecord(result)?.createIssue)?.issue
  return parseIssueNode(issue)
}

export async function runIssueUpdate(
  graphqlClient: GraphqlClient,
  input: IssueUpdateInput,
): Promise<IssueMutationData> {
  assertIssueUpdateInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_UPDATE_MUTATION, {
    issueId: input.issueId,
    title: input.title,
    body: input.body,
  })
  const issue = asRecord(asRecord(result)?.updateIssue)?.issue
  return parseIssueNode(issue)
}

export async function runIssueClose(
  graphqlClient: GraphqlClient,
  input: IssueMutationInput,
): Promise<IssueMutationData> {
  assertIssueMutationInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_CLOSE_MUTATION, {
    issueId: input.issueId,
  })
  const issueData = parseIssueNode(asRecord(asRecord(result)?.closeIssue)?.issue)
  return {
    ...issueData,
    closed: issueData.state === "CLOSED",
  }
}

export async function runIssueReopen(
  graphqlClient: GraphqlClient,
  input: IssueMutationInput,
): Promise<IssueMutationData> {
  assertIssueMutationInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_REOPEN_MUTATION, {
    issueId: input.issueId,
  })
  const issueData = parseIssueNode(asRecord(asRecord(result)?.reopenIssue)?.issue)
  return {
    ...issueData,
    reopened: issueData.state === "OPEN",
  }
}

export async function runIssueDelete(
  graphqlClient: GraphqlClient,
  input: IssueMutationInput,
): Promise<IssueMutationData> {
  assertIssueMutationInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_DELETE_MUTATION, {
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
  graphqlClient: GraphqlClient,
  input: IssueLabelsUpdateInput,
): Promise<IssueLabelsUpdateData> {
  assertIssueLabelsUpdateInput(input)

  const lookupResult = await graphqlClient.query<unknown, GraphqlVariables>(
    ISSUE_LABELS_LOOKUP_QUERY,
    {
      issueId: input.issueId,
    },
  )
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

  const result = await graphqlClient.query<unknown, GraphqlVariables>(
    ISSUE_LABELS_UPDATE_MUTATION,
    {
      issueId: input.issueId,
      labelIds,
    },
  )
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
  graphqlClient: GraphqlClient,
  input: IssueLabelsAddInput,
): Promise<IssueLabelsAddData> {
  assertIssueLabelsAddInput(input)

  const lookupResult = await graphqlClient.query<unknown, GraphqlVariables>(
    ISSUE_LABELS_LOOKUP_QUERY,
    {
      issueId: input.issueId,
    },
  )
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

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_LABELS_ADD_MUTATION, {
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
  graphqlClient: GraphqlClient,
  input: IssueAssigneesUpdateInput,
): Promise<IssueAssigneesUpdateData> {
  assertIssueAssigneesUpdateInput(input)

  const lookupResult = await graphqlClient.query<unknown, GraphqlVariables>(
    ISSUE_ASSIGNEES_LOOKUP_QUERY,
    {
      issueId: input.issueId,
    },
  )
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

  const result = await graphqlClient.query<unknown, GraphqlVariables>(
    ISSUE_ASSIGNEES_UPDATE_MUTATION,
    {
      issueId: input.issueId,
      assigneeIds,
    },
  )
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
  graphqlClient: GraphqlClient,
  input: IssueMilestoneSetInput,
): Promise<IssueMilestoneSetData> {
  assertIssueMilestoneSetInput(input)

  let milestoneId: string | null = null
  if (input.milestoneNumber !== null) {
    const lookupResult = await graphqlClient.query<unknown, GraphqlVariables>(
      ISSUE_MILESTONE_LOOKUP_QUERY,
      {
        issueId: input.issueId,
        milestoneNumber: input.milestoneNumber,
      },
    )
    const resolvedId = asRecord(
      asRecord(asRecord(asRecord(lookupResult)?.node)?.repository)?.milestone,
    )?.id
    if (typeof resolvedId !== "string" || resolvedId.length === 0) {
      throw new Error(`Milestone not found: ${input.milestoneNumber}`)
    }
    milestoneId = resolvedId
  }

  const result = await graphqlClient.query<unknown, GraphqlVariables>(
    ISSUE_MILESTONE_SET_MUTATION,
    {
      issueId: input.issueId,
      milestoneId,
    },
  )
  const mutation = asRecord(asRecord(result)?.["updateIssue"])
  const issue = asRecord(mutation?.["issue"])
  const milestone = asRecord(issue?.["milestone"])

  return {
    id: assertNonEmptyString(issue?.["id"], "Issue id"),
    milestoneNumber: typeof milestone?.["number"] === "number" ? milestone["number"] : null,
  }
}

export async function runIssueCommentCreate(
  graphqlClient: GraphqlClient,
  input: IssueCommentCreateInput,
): Promise<IssueCommentCreateData> {
  assertIssueCommentCreateInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(
    ISSUE_COMMENT_CREATE_MUTATION,
    {
      issueId: input.issueId,
      body: input.body,
    },
  )
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
  graphqlClient: GraphqlClient,
  input: IssueLinkedPrsListInput,
): Promise<IssueLinkedPrsListData> {
  assertIssueLinkedPrsListInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_LINKED_PRS_LIST_QUERY, {
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
  graphqlClient: GraphqlClient,
  input: IssueRelationsGetInput,
): Promise<IssueRelationsGetData> {
  assertIssueRelationsGetInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_RELATIONS_GET_QUERY, {
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
  graphqlClient: GraphqlClient,
  input: IssueParentSetInput,
): Promise<IssueParentSetData> {
  assertIssueParentSetInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_PARENT_SET_MUTATION, {
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
  graphqlClient: GraphqlClient,
  input: IssueParentRemoveInput,
): Promise<IssueParentRemoveData> {
  assertIssueParentRemoveInput(input)

  const lookupResult = await graphqlClient.query<unknown, GraphqlVariables>(
    ISSUE_PARENT_LOOKUP_QUERY,
    {
      issueId: input.issueId,
    },
  )
  const parentIssueId = asRecord(asRecord(asRecord(lookupResult)?.node)?.parent)?.id
  if (typeof parentIssueId !== "string" || parentIssueId.length === 0) {
    throw new Error("Issue parent removal failed")
  }

  const result = await graphqlClient.query<unknown, GraphqlVariables>(
    ISSUE_PARENT_REMOVE_MUTATION,
    {
      issueId: input.issueId,
      parentIssueId,
    },
  )
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
  graphqlClient: GraphqlClient,
  input: IssueBlockedByInput,
): Promise<IssueBlockedByData> {
  assertIssueBlockedByInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(
    ISSUE_BLOCKED_BY_ADD_MUTATION,
    {
      issueId: input.issueId,
      blockedByIssueId: input.blockedByIssueId,
    },
  )
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
  graphqlClient: GraphqlClient,
  input: IssueBlockedByInput,
): Promise<IssueBlockedByData> {
  assertIssueBlockedByInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(
    ISSUE_BLOCKED_BY_REMOVE_MUTATION,
    {
      issueId: input.issueId,
      blockedByIssueId: input.blockedByIssueId,
    },
  )
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
