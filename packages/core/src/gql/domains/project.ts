import { assertProjectInput, assertProjectOrgInput, assertProjectUserInput } from "../assertions.js"
import { getSdk as getProjectV2FieldsListOrgSdk } from "../operations/project-v2-fields-list-org.generated.js"
import { getSdk as getProjectV2FieldsListUserSdk } from "../operations/project-v2-fields-list-user.generated.js"
import { getSdk as getAddProjectV2ItemSdk } from "../operations/project-v2-item-add.generated.js"
import { getSdk as getUpdateProjectV2ItemFieldSdk } from "../operations/project-v2-item-field-update.generated.js"
import { getSdk as getRemoveProjectV2ItemSdk } from "../operations/project-v2-item-remove.generated.js"
import { getSdk as getProjectV2ItemsListOrgSdk } from "../operations/project-v2-items-list-org.generated.js"
import { getSdk as getProjectV2ItemsListUserSdk } from "../operations/project-v2-items-list-user.generated.js"
import type { ProjectV2OrgViewQuery } from "../operations/project-v2-org-view.generated.js"
import { getSdk as getProjectV2OrgViewSdk } from "../operations/project-v2-org-view.generated.js"
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
    url: project != null ? String(project.url) : null,
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
    url: project != null ? String(project.url) : null,
  }
}

export async function runProjectV2FieldsList(
  transport: GraphqlTransport,
  input: ProjectV2FieldsListInput,
): Promise<ProjectV2FieldsListData> {
  assertProjectInput(input)
  const client = createGraphqlRequestClient(transport)

  const orgResult = await getProjectV2FieldsListOrgSdk(client).ProjectV2FieldsListOrg({
    owner: input.owner,
    projectNumber: input.projectNumber,
    first: input.first,
    ...(input.after !== undefined ? { after: input.after } : {}),
  })

  let conn = orgResult.organization?.projectV2?.fields

  if (!conn) {
    const userResult = await getProjectV2FieldsListUserSdk(client).ProjectV2FieldsListUser({
      owner: input.owner,
      projectNumber: input.projectNumber,
      first: input.first,
      ...(input.after !== undefined ? { after: input.after } : {}),
    })
    conn = userResult.user?.projectV2?.fields
  }

  if (!conn) {
    return {
      items: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    }
  }

  return {
    items: (conn.nodes ?? []).map(
      (n): ProjectV2FieldItemData => ({
        id: n?.id ?? null,
        name: n?.name ?? null,
        dataType: n != null ? String(n.dataType) : null,
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

  const orgResult = await getProjectV2ItemsListOrgSdk(client).ProjectV2ItemsListOrg({
    owner: input.owner,
    projectNumber: input.projectNumber,
    first: input.first,
    ...(input.after !== undefined ? { after: input.after } : {}),
  })

  let conn = orgResult.organization?.projectV2?.items

  if (!conn) {
    const userResult = await getProjectV2ItemsListUserSdk(client).ProjectV2ItemsListUser({
      owner: input.owner,
      projectNumber: input.projectNumber,
      first: input.first,
      ...(input.after !== undefined ? { after: input.after } : {}),
    })
    conn = userResult.user?.projectV2?.items
  }

  if (!conn) {
    return {
      items: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    }
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
  if (!input.projectId || input.projectId.trim().length === 0) {
    throw new Error("projectId is required")
  }
  if (!input.contentId || input.contentId.trim().length === 0) {
    throw new Error("contentId is required")
  }

  const client = createGraphqlRequestClient(transport)
  const result = await getAddProjectV2ItemSdk(client).AddProjectV2Item({
    projectId: input.projectId,
    contentId: input.contentId,
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
  if (!input.projectId || input.projectId.trim().length === 0) {
    throw new Error("projectId is required")
  }
  if (!input.itemId || input.itemId.trim().length === 0) {
    throw new Error("itemId is required")
  }

  const client = createGraphqlRequestClient(transport)
  const result = await getRemoveProjectV2ItemSdk(client).RemoveProjectV2Item({
    projectId: input.projectId,
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
  if (!input.projectId || input.projectId.trim().length === 0) {
    throw new Error("projectId is required")
  }
  if (!input.itemId || input.itemId.trim().length === 0) {
    throw new Error("itemId is required")
  }
  if (!input.fieldId || input.fieldId.trim().length === 0) {
    throw new Error("fieldId is required")
  }

  const client = createGraphqlRequestClient(transport)
  const result = await getUpdateProjectV2ItemFieldSdk(client).UpdateProjectV2ItemField({
    projectId: input.projectId,
    itemId: input.itemId,
    fieldId: input.fieldId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: input.value as any,
  })

  const projectV2Item = result.updateProjectV2ItemFieldValue?.projectV2Item
  if (!projectV2Item) {
    throw new Error("Failed to update project item field")
  }

  return {
    itemId: projectV2Item.id,
  }
}
