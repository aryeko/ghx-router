import type { GraphQLClient } from "graphql-request"
import {
  assertNonEmptyString,
  assertProjectInput,
  assertProjectOrgInput,
  assertProjectUserInput,
} from "../assertions.js"
import type * as Types from "../operations/base-types.js"
import { getSdk as getProjectV2FieldsListOrgSdk } from "../operations/project-v2-fields-list-org.generated.js"
import { getSdk as getProjectV2FieldsListUserSdk } from "../operations/project-v2-fields-list-user.generated.js"
import { getSdk as getProjectV2IssueNodeIdSdk } from "../operations/project-v2-issue-node-id.generated.js"
import { getSdk as getAddProjectV2ItemSdk } from "../operations/project-v2-item-add.generated.js"
import { getSdk as getUpdateProjectV2ItemFieldSdk } from "../operations/project-v2-item-field-update.generated.js"
import { getSdk as getRemoveProjectV2ItemSdk } from "../operations/project-v2-item-remove.generated.js"
import { getSdk as getProjectV2ItemsListOrgSdk } from "../operations/project-v2-items-list-org.generated.js"
import { getSdk as getProjectV2ItemsListUserSdk } from "../operations/project-v2-items-list-user.generated.js"
import { getSdk as getProjectV2OrgIdSdk } from "../operations/project-v2-org-id.generated.js"
import type { ProjectV2OrgViewQuery } from "../operations/project-v2-org-view.generated.js"
import { getSdk as getProjectV2OrgViewSdk } from "../operations/project-v2-org-view.generated.js"
import { getSdk as getProjectV2UserIdSdk } from "../operations/project-v2-user-id.generated.js"
import type { ProjectV2UserViewQuery } from "../operations/project-v2-user-view.generated.js"
import { getSdk as getProjectV2UserViewSdk } from "../operations/project-v2-user-view.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { createGraphqlRequestClient } from "../transport.js"
import type {
  ProjectV2FieldItemData,
  ProjectV2FieldsListData,
  ProjectV2FieldsListInput,
  ProjectV2ItemAddData,
  ProjectV2ItemAddInput,
  ProjectV2ItemData,
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
} from "../types.js"

async function resolveProjectId(
  client: GraphQLClient,
  owner: string,
  projectNumber: number,
): Promise<string> {
  const orgResult = await getProjectV2OrgIdSdk(client).ProjectV2OrgId({
    org: owner,
    projectNumber,
  })
  if (orgResult.organization?.projectV2?.id) {
    return orgResult.organization.projectV2.id
  }

  const userResult = await getProjectV2UserIdSdk(client).ProjectV2UserId({
    login: owner,
    number: projectNumber,
  })
  if (userResult.user?.projectV2?.id) {
    return userResult.user.projectV2.id
  }

  throw new Error(`Project #${projectNumber} not found for owner "${owner}"`)
}

async function resolveIssueNodeId(client: GraphQLClient, issueUrl: string): Promise<string> {
  const result = await getProjectV2IssueNodeIdSdk(client).ProjectV2IssueNodeId({
    url: issueUrl as Types.Scalars["URI"]["input"],
  })
  const resource = result.resource
  if (resource && "__typename" in resource && resource.__typename === "Issue" && "id" in resource) {
    return resource.id
  }
  throw new Error(`Issue not found at URL "${issueUrl}"`)
}

export function buildFieldValue(input: ProjectV2ItemFieldUpdateInput): Types.ProjectV2FieldValue {
  if (
    input.clear === true &&
    (input.valueText !== undefined ||
      input.valueNumber !== undefined ||
      input.valueDate !== undefined ||
      input.valueSingleSelectOptionId !== undefined ||
      input.valueIterationId !== undefined)
  ) {
    throw new Error("Cannot set clear and a value field simultaneously")
  }
  if (input.clear) return {}
  if (input.valueText !== undefined) return { text: input.valueText }
  if (input.valueNumber !== undefined) return { number: input.valueNumber }
  if (input.valueDate !== undefined) return { date: input.valueDate }
  if (input.valueSingleSelectOptionId !== undefined) {
    return { singleSelectOptionId: input.valueSingleSelectOptionId }
  }
  if (input.valueIterationId !== undefined) return { iterationId: input.valueIterationId }
  throw new Error("At least one value field must be provided")
}

export async function runProjectV2OrgView(
  transport: GraphqlTransport,
  input: ProjectV2OrgViewInput,
): Promise<ProjectV2OrgViewData> {
  assertProjectOrgInput(input)
  const sdk = getProjectV2OrgViewSdk(createGraphqlRequestClient(transport))
  const result: ProjectV2OrgViewQuery = await sdk.ProjectV2OrgView(input)
  const project = result.organization?.projectV2
  if (!project) {
    throw new Error(`Project ${input.projectNumber} not found for org ${input.org}`)
  }
  return {
    id: project.id ?? null,
    title: project.title ?? null,
    shortDescription: project.shortDescription ?? null,
    public: project.public ?? null,
    closed: project.closed ?? null,
    url: project.url != null ? String(project.url) : null,
  }
}

export async function runProjectV2UserView(
  transport: GraphqlTransport,
  input: ProjectV2UserViewInput,
): Promise<ProjectV2UserViewData> {
  assertProjectUserInput(input)
  const sdk = getProjectV2UserViewSdk(createGraphqlRequestClient(transport))
  const result: ProjectV2UserViewQuery = await sdk.ProjectV2UserView(input)
  const project = result.user?.projectV2
  if (!project) {
    throw new Error(`Project ${input.projectNumber} not found for user ${input.user}`)
  }
  return {
    id: project.id ?? null,
    title: project.title ?? null,
    shortDescription: project.shortDescription ?? null,
    public: project.public ?? null,
    closed: project.closed ?? null,
    url: project.url != null ? String(project.url) : null,
  }
}

export async function runProjectV2FieldsList(
  transport: GraphqlTransport,
  input: ProjectV2FieldsListInput,
): Promise<ProjectV2FieldsListData> {
  assertProjectInput(input)
  const client = createGraphqlRequestClient(transport)

  // Tries org lookup first; falls back to user lookup if the owner is not an org.
  // This costs an extra network round-trip when the owner is a user account.

  const first = input.first ?? 30

  const orgResult = await getProjectV2FieldsListOrgSdk(client).ProjectV2FieldsListOrg({
    owner: input.owner,
    projectNumber: input.projectNumber,
    first,
    ...(input.after !== undefined ? { after: input.after } : {}),
  })

  let conn = orgResult.organization?.projectV2?.fields

  if (!conn) {
    const userResult = await getProjectV2FieldsListUserSdk(client).ProjectV2FieldsListUser({
      owner: input.owner,
      projectNumber: input.projectNumber,
      first,
      ...(input.after !== undefined ? { after: input.after } : {}),
    })
    conn = userResult.user?.projectV2?.fields
  }

  if (!conn) {
    throw new Error(`Project #${input.projectNumber} not found for owner "${input.owner}"`)
  }

  return {
    items: (conn.nodes ?? []).map(
      (n): ProjectV2FieldItemData => ({
        id: n?.id ?? null,
        name: n?.name ?? null,
        dataType: n != null ? String(n.dataType) : null,
        options:
          n != null && "__typename" in n && n.__typename === "ProjectV2SingleSelectField"
            ? (n as { options: Array<{ id: string; name: string }> }).options
            : null,
      }),
    ),
    pageInfo: {
      hasNextPage: conn.pageInfo.hasNextPage ?? false,
      endCursor: conn.pageInfo.endCursor ?? null,
    },
  }
}

export async function runProjectV2ItemsList(
  transport: GraphqlTransport,
  input: ProjectV2ItemsListInput,
): Promise<ProjectV2ItemsListData> {
  assertProjectInput(input)
  const client = createGraphqlRequestClient(transport)

  // Tries org lookup first; falls back to user lookup if the owner is not an org.
  // This costs an extra network round-trip when the owner is a user account.

  const first = input.first ?? 30

  const orgResult = await getProjectV2ItemsListOrgSdk(client).ProjectV2ItemsListOrg({
    owner: input.owner,
    projectNumber: input.projectNumber,
    first,
    ...(input.after !== undefined ? { after: input.after } : {}),
  })

  let conn = orgResult.organization?.projectV2?.items

  if (!conn) {
    const userResult = await getProjectV2ItemsListUserSdk(client).ProjectV2ItemsListUser({
      owner: input.owner,
      projectNumber: input.projectNumber,
      first,
      ...(input.after !== undefined ? { after: input.after } : {}),
    })
    conn = userResult.user?.projectV2?.items
  }

  if (!conn) {
    throw new Error(`Project #${input.projectNumber} not found for owner "${input.owner}"`)
  }

  return {
    items: (conn.nodes ?? []).map((n): ProjectV2ItemData => {
      const content = n?.content ?? null
      return {
        id: n?.id ?? null,
        contentType: n != null ? String(n.type) : null,
        contentNumber: content != null && "number" in content ? content.number : null,
        contentTitle: content?.title ?? null,
      }
    }),
    pageInfo: {
      hasNextPage: conn.pageInfo.hasNextPage ?? false,
      endCursor: conn.pageInfo.endCursor ?? null,
    },
  }
}

export async function runProjectV2ItemAdd(
  transport: GraphqlTransport,
  input: ProjectV2ItemAddInput,
): Promise<ProjectV2ItemAddData> {
  assertProjectInput(input)
  if (!input.issueUrl || input.issueUrl.trim().length === 0) {
    throw new Error("issueUrl is required")
  }

  const client = createGraphqlRequestClient(transport)
  const projectId = await resolveProjectId(client, input.owner, input.projectNumber)
  const contentId = await resolveIssueNodeId(client, input.issueUrl)

  const result = await getAddProjectV2ItemSdk(client).AddProjectV2Item({
    projectId,
    contentId,
  })

  const item = result.addProjectV2ItemById?.item
  if (!item) {
    throw new Error("Failed to add item to project")
  }

  return {
    itemId: item.id,
    itemType: item.type != null ? String(item.type) : null,
  }
}

export async function runProjectV2ItemRemove(
  transport: GraphqlTransport,
  input: ProjectV2ItemRemoveInput,
): Promise<ProjectV2ItemRemoveData> {
  assertProjectInput(input)
  if (!input.itemId || input.itemId.trim().length === 0) {
    throw new Error("itemId is required")
  }

  const client = createGraphqlRequestClient(transport)
  const projectId = await resolveProjectId(client, input.owner, input.projectNumber)

  const result = await getRemoveProjectV2ItemSdk(client).RemoveProjectV2Item({
    projectId,
    itemId: input.itemId,
  })

  const deletedItemId = result.deleteProjectV2Item?.deletedItemId
  if (!deletedItemId) {
    throw new Error("Failed to remove item from project")
  }

  return {
    deletedItemId,
  }
}

export async function runProjectV2ItemFieldUpdate(
  transport: GraphqlTransport,
  input: ProjectV2ItemFieldUpdateInput,
): Promise<ProjectV2ItemFieldUpdateData> {
  assertNonEmptyString(input.projectId, "projectId")
  assertNonEmptyString(input.itemId, "itemId")
  assertNonEmptyString(input.fieldId, "fieldId")

  const client = createGraphqlRequestClient(transport)
  const value = buildFieldValue(input)

  const result = await getUpdateProjectV2ItemFieldSdk(client).UpdateProjectV2ItemField({
    projectId: input.projectId,
    itemId: input.itemId,
    fieldId: input.fieldId,
    value,
  })

  const projectV2Item = result.updateProjectV2ItemFieldValue?.projectV2Item
  if (!projectV2Item) {
    throw new Error("Failed to update project item field")
  }

  return {
    itemId: projectV2Item.id,
  }
}
