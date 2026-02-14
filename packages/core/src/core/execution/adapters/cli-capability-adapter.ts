import { errorCodes } from "../../errors/codes.js"
import { mapErrorToCode } from "../../errors/map-error.js"
import { isRetryableErrorCode } from "../../errors/retryability.js"
import type { ResultEnvelope } from "../../contracts/envelope.js"
import type { OperationCard } from "../../registry/types.js"
import { normalizeError, normalizeResult } from "../normalizer.js"

export type CliCapabilityId =
  | "repo.view"
  | "repo.labels.list"
  | "repo.issue_types.list"
  | "issue.view"
  | "issue.list"
  | "issue.comments.list"
  | "pr.view"
  | "pr.list"
  | "pr.status.checks"
  | "pr.checks.get_failed"
  | "pr.mergeability.view"
  | "pr.ready_for_review.set"
  | "check_run.annotations.list"
  | "workflow_runs.list"
  | "workflow_run.jobs.list"
  | "workflow_job.logs.get"
  | "workflow_job.logs.analyze"
  | "workflow.list"
  | "workflow.get"
  | "workflow_run.get"
  | "workflow_run.rerun_all"
  | "workflow_run.cancel"
  | "workflow_run.artifacts.list"
  | "project_v2.org.get"
  | "project_v2.user.get"
  | "project_v2.fields.list"
  | "project_v2.items.list"
  | "project_v2.item.add_issue"
  | "project_v2.item.field.update"

export type CliCommandRunner = {
  run(command: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number }>
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_LIST_FIRST = 30
const MAX_WORKFLOW_JOB_LOG_CHARS = 50_000
const REDACTED_CLI_ERROR_MESSAGE = "gh command failed; stderr redacted for safety"
const REPO_ISSUE_TYPES_GRAPHQL_QUERY =
  "query($owner:String!,$name:String!,$first:Int!,$after:String){repository(owner:$owner,name:$name){issueTypes(first:$first,after:$after){nodes{id name color isEnabled} pageInfo{hasNextPage endCursor}}}}"
const ISSUE_COMMENTS_GRAPHQL_QUERY =
  "query($owner:String!,$name:String!,$issueNumber:Int!,$first:Int!,$after:String){repository(owner:$owner,name:$name){issue(number:$issueNumber){comments(first:$first,after:$after){nodes{id body createdAt url author{login}} pageInfo{hasNextPage endCursor}}}}}"

function containsSensitiveText(value: string): boolean {
  return /(gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|authorization:\s*bearer\s+\S+|bearer\s+[A-Za-z0-9._-]{20,}|(?:api[_-]?key|token|secret|password)\s*[=:]\s*\S+)/i.test(
    value
  )
}

function sanitizeCliErrorMessage(stderr: string, exitCode: number): string {
  const trimmed = stderr.trim()
  if (!trimmed) {
    return `gh exited with code ${exitCode}`
  }

  if (containsSensitiveText(trimmed)) {
    return REDACTED_CLI_ERROR_MESSAGE
  }

  return trimmed
}

function parseStrictPositiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null
}

function parseListFirst(value: unknown): number | null {
  if (value === undefined) {
    return DEFAULT_LIST_FIRST
  }

  return parseStrictPositiveInt(value)
}

function parseNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function commandTokens(card: OperationCard | undefined, fallbackCommand: string): string[] {
  const fromCard = card?.cli?.command
  const command = typeof fromCard === "string" && fromCard.trim().length > 0 ? fromCard : fallbackCommand
  return command.trim().split(/\s+/)
}

function jsonFieldsFromCard(card: OperationCard | undefined, fallbackFields: string): string {
  const fields = card?.cli?.jsonFields
  if (Array.isArray(fields) && fields.length > 0) {
    return fields.join(",")
  }

  return fallbackFields
}

function buildArgs(capabilityId: CliCapabilityId, params: Record<string, unknown>, card?: OperationCard): string[] {
  const owner = String(params.owner ?? "")
  const name = String(params.name ?? "")
  const repo = owner && name ? `${owner}/${name}` : ""

  if (capabilityId === "repo.view") {
    const args = commandTokens(card, "repo view")
    if (repo) {
      args.push(repo)
    }

    args.push("--json", jsonFieldsFromCard(card, "id,name,nameWithOwner,isPrivate,stargazerCount,forkCount,url,defaultBranchRef"))
    return args
  }

  if (capabilityId === "repo.labels.list") {
    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for repo.labels.list")
    }

    const args = commandTokens(card, "label list")
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--limit", String(first), "--json", jsonFieldsFromCard(card, "id,name,description,color,isDefault"))
    return args
  }

  if (capabilityId === "repo.issue_types.list") {
    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for repo.issue_types.list")
    }

    const after = params.after
    if (!(after === undefined || after === null || typeof after === "string")) {
      throw new Error("Invalid after cursor for repo.issue_types.list")
    }

    if (!owner || !name) {
      throw new Error("Missing owner/name for repo.issue_types.list")
    }

    const args = [
      ...commandTokens(card, "api graphql"),
      "-f",
      `query=${REPO_ISSUE_TYPES_GRAPHQL_QUERY}`,
      "-f",
      `owner=${owner}`,
      "-f",
      `name=${name}`,
      "-F",
      `first=${first}`
    ]

    if (typeof after === "string" && after.length > 0) {
      args.push("-f", `after=${after}`)
    }

    return args
  }

  if (capabilityId === "issue.view") {
    const issueNumber = parseStrictPositiveInt(params.issueNumber)
    if (issueNumber === null) {
      throw new Error("Missing or invalid issueNumber for issue.view")
    }

    const args = [...commandTokens(card, "issue view"), String(issueNumber)]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", jsonFieldsFromCard(card, "id,number,title,state,url"))
    return args
  }

  if (capabilityId === "issue.list") {
    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for issue.list")
    }

    const args = commandTokens(card, "issue list")
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--limit", String(first), "--json", jsonFieldsFromCard(card, "id,number,title,state,url"))
    return args
  }

  if (capabilityId === "issue.comments.list") {
    const issueNumber = parseStrictPositiveInt(params.issueNumber)
    if (issueNumber === null) {
      throw new Error("Missing or invalid issueNumber for issue.comments.list")
    }

    const first = parseStrictPositiveInt(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for issue.comments.list")
    }

    const after = params.after
    if (!(after === undefined || after === null || typeof after === "string")) {
      throw new Error("Invalid after cursor for issue.comments.list")
    }

    const args = [
      ...commandTokens(card, "api graphql"),
      "-f",
      `query=${ISSUE_COMMENTS_GRAPHQL_QUERY}`,
      "-f",
      `owner=${owner}`,
      "-f",
      `name=${name}`,
      "-F",
      `issueNumber=${issueNumber}`,
      "-F",
      `first=${first}`
    ]

    if (typeof after === "string" && after.length > 0) {
      args.push("-f", `after=${after}`)
    }

    return args
  }

  if (capabilityId === "pr.view") {
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) {
      throw new Error("Missing or invalid prNumber for pr.view")
    }

    const args = [...commandTokens(card, "pr view"), String(prNumber)]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", jsonFieldsFromCard(card, "id,number,title,state,url"))
    return args
  }

  if (capabilityId === "pr.list") {
    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for pr.list")
    }

    const args = commandTokens(card, "pr list")
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--limit", String(first), "--json", jsonFieldsFromCard(card, "id,number,title,state,url"))
    return args
  }

  if (capabilityId === "pr.status.checks" || capabilityId === "pr.checks.get_failed") {
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) {
      throw new Error(`Missing or invalid prNumber for ${capabilityId}`)
    }

    const args = [...commandTokens(card, "pr checks"), String(prNumber)]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", jsonFieldsFromCard(card, "name,state,bucket,workflow,link"))
    return args
  }

  if (capabilityId === "pr.mergeability.view") {
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) {
      throw new Error("Missing or invalid prNumber for pr.mergeability.view")
    }

    const args = [...commandTokens(card, "pr view"), String(prNumber)]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", jsonFieldsFromCard(card, "mergeable,mergeStateStatus,reviewDecision,isDraft,state"))
    return args
  }

  if (capabilityId === "pr.ready_for_review.set") {
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) {
      throw new Error("Missing or invalid prNumber for pr.ready_for_review.set")
    }

    if (typeof params.ready !== "boolean") {
      throw new Error("Missing or invalid ready for pr.ready_for_review.set")
    }

    const args = [...commandTokens(card, "pr ready"), String(prNumber)]
    if (repo) {
      args.push("--repo", repo)
    }

    if (!params.ready) {
      args.push("--undo")
    }

    return args
  }

  if (capabilityId === "check_run.annotations.list") {
    const checkRunId = parseStrictPositiveInt(params.checkRunId)
    if (checkRunId === null) {
      throw new Error("Missing or invalid checkRunId for check_run.annotations.list")
    }

    if (!owner || !name) {
      throw new Error("Missing owner/name for check_run.annotations.list")
    }

    const args = [...commandTokens(card, "api"), `repos/${owner}/${name}/check-runs/${checkRunId}/annotations`]
    return args
  }

  if (capabilityId === "workflow_runs.list") {
    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for workflow_runs.list")
    }

    const args = commandTokens(card, "run list")
    if (repo) {
      args.push("--repo", repo)
    }

    if (typeof params.branch === "string" && params.branch.length > 0) {
      args.push("--branch", params.branch)
    }
    if (typeof params.event === "string" && params.event.length > 0) {
      args.push("--event", params.event)
    }
    if (typeof params.status === "string" && params.status.length > 0) {
      args.push("--status", params.status)
    }

    args.push("--limit", String(first), "--json", jsonFieldsFromCard(card, "databaseId,workflowName,status,conclusion,headBranch,url"))
    return args
  }

  if (capabilityId === "workflow_run.jobs.list") {
    const runId = parseStrictPositiveInt(params.runId)
    if (runId === null) {
      throw new Error("Missing or invalid runId for workflow_run.jobs.list")
    }

    const args = [...commandTokens(card, "run view"), String(runId)]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", "jobs")
    return args
  }

  if (capabilityId === "workflow_job.logs.get" || capabilityId === "workflow_job.logs.analyze") {
    const jobId = parseStrictPositiveInt(params.jobId)
    if (jobId === null) {
      throw new Error(`Missing or invalid jobId for ${capabilityId}`)
    }

    const args = [...commandTokens(card, "run view"), "--job", String(jobId), "--log"]
    if (repo) {
      args.push("--repo", repo)
    }

    return args
  }

  if (capabilityId === "workflow.list") {
    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for workflow.list")
    }

    const args = commandTokens(card, "workflow list")
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--limit", String(first), "--json", jsonFieldsFromCard(card, "id,name,path,state"))
    return args
  }

  if (capabilityId === "workflow.get") {
    const workflowId = parseNonEmptyString(params.workflowId) ?? (typeof params.workflowId === "number" ? String(params.workflowId) : null)
    if (workflowId === null) {
      throw new Error("Missing or invalid workflowId for workflow.get")
    }

    const args = [...commandTokens(card, "workflow view"), workflowId]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", jsonFieldsFromCard(card, "id,name,path,state,url"))
    return args
  }

  if (capabilityId === "workflow_run.get") {
    const runId = parseStrictPositiveInt(params.runId)
    if (runId === null) {
      throw new Error("Missing or invalid runId for workflow_run.get")
    }

    const args = [...commandTokens(card, "run view"), String(runId)]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", jsonFieldsFromCard(card, "databaseId,workflowName,status,conclusion,headBranch,headSha,url,event,createdAt,updatedAt,startedAt"))
    return args
  }

  if (capabilityId === "workflow_run.rerun_all" || capabilityId === "workflow_run.cancel") {
    const runId = parseStrictPositiveInt(params.runId)
    if (runId === null) {
      throw new Error(`Missing or invalid runId for ${capabilityId}`)
    }

    const args = [
      ...commandTokens(card, capabilityId === "workflow_run.rerun_all" ? "run rerun" : "run cancel"),
      String(runId)
    ]

    if (repo) {
      args.push("--repo", repo)
    }

    return args
  }

  if (capabilityId === "workflow_run.artifacts.list") {
    const runId = parseStrictPositiveInt(params.runId)
    if (runId === null) {
      throw new Error("Missing or invalid runId for workflow_run.artifacts.list")
    }

    const args = [...commandTokens(card, "run view"), String(runId)]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", jsonFieldsFromCard(card, "artifacts"))
    return args
  }

  if (capabilityId === "project_v2.org.get" || capabilityId === "project_v2.user.get") {
    const ownerParam = capabilityId === "project_v2.org.get" ? params.org : params.user
    const owner = parseNonEmptyString(ownerParam)
    const projectNumber = parseStrictPositiveInt(params.projectNumber)
    if (owner === null || projectNumber === null) {
      throw new Error(`Missing or invalid owner/projectNumber for ${capabilityId}`)
    }

    const args = [...commandTokens(card, "project view"), String(projectNumber), "--owner", owner, "--format", "json"]
    return args
  }

  if (capabilityId === "project_v2.fields.list") {
    const projectNumber = parseStrictPositiveInt(params.projectNumber)
    const projectOwner = parseNonEmptyString(params.owner)
    if (projectNumber === null || projectOwner === null) {
      throw new Error("Missing or invalid owner/projectNumber for project_v2.fields.list")
    }

    const args = [...commandTokens(card, "project field-list"), String(projectNumber), "--owner", projectOwner, "--format", "json"]
    return args
  }

  if (capabilityId === "project_v2.items.list") {
    const projectNumber = parseStrictPositiveInt(params.projectNumber)
    const projectOwner = parseNonEmptyString(params.owner)
    const first = parseListFirst(params.first)
    if (projectNumber === null || projectOwner === null || first === null) {
      throw new Error("Missing or invalid owner/projectNumber/first for project_v2.items.list")
    }

    const args = [
      ...commandTokens(card, "project item-list"),
      String(projectNumber),
      "--owner",
      projectOwner,
      "--format",
      "json",
      "--limit",
      String(first)
    ]
    return args
  }

  if (capabilityId === "project_v2.item.add_issue") {
    const projectNumber = parseStrictPositiveInt(params.projectNumber)
    const projectOwner = parseNonEmptyString(params.owner)
    const issueUrl = parseNonEmptyString(params.issueUrl)
    if (projectNumber === null || projectOwner === null || issueUrl === null) {
      throw new Error("Missing or invalid owner/projectNumber/issueUrl for project_v2.item.add_issue")
    }

    const args = [
      ...commandTokens(card, "project item-add"),
      String(projectNumber),
      "--owner",
      projectOwner,
      "--url",
      issueUrl,
      "--format",
      "json"
    ]
    return args
  }

  if (capabilityId === "project_v2.item.field.update") {
    const projectId = parseNonEmptyString(params.projectId)
    const itemId = parseNonEmptyString(params.itemId)
    const fieldId = parseNonEmptyString(params.fieldId)
    if (projectId === null || itemId === null || fieldId === null) {
      throw new Error("Missing or invalid projectId/itemId/fieldId for project_v2.item.field.update")
    }

    const args = [
      ...commandTokens(card, "project item-edit"),
      "--project-id",
      projectId,
      "--id",
      itemId,
      "--field-id",
      fieldId
    ]

    const valueText = parseNonEmptyString(params.valueText)
    const valueDate = parseNonEmptyString(params.valueDate)
    const valueSingleSelectOptionId = parseNonEmptyString(params.valueSingleSelectOptionId)
    const valueIterationId = parseNonEmptyString(params.valueIterationId)
    const clear = params.clear === true

    if (valueText !== null) {
      args.push("--text", valueText)
    } else if (typeof params.valueNumber === "number" && Number.isFinite(params.valueNumber)) {
      args.push("--number", String(params.valueNumber))
    } else if (valueDate !== null) {
      args.push("--date", valueDate)
    } else if (valueSingleSelectOptionId !== null) {
      args.push("--single-select-option-id", valueSingleSelectOptionId)
    } else if (valueIterationId !== null) {
      args.push("--iteration-id", valueIterationId)
    } else if (clear) {
      args.push("--clear")
    } else {
      throw new Error("Missing field value update for project_v2.item.field.update")
    }

    return args
  }

  throw new Error(`Unsupported CLI capability: ${capabilityId}`)
}

function parseCliData(stdout: string): unknown {
  const trimmed = stdout.trim()
  if (!trimmed) {
    return {}
  }

  return JSON.parse(trimmed)
}

function normalizeListItem(item: unknown): Record<string, unknown> {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return {}
  }

  const input = item as Record<string, unknown>
  return {
    id: input.id,
    number: input.number,
    title: input.title,
    state: input.state,
    url: input.url
  }
}

function normalizeWorkflowItem(item: unknown): Record<string, unknown> {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return {
      id: 0,
      name: null,
      path: null,
      state: null
    }
  }

  const input = item as Record<string, unknown>
  return {
    id: typeof input.id === "number" ? input.id : 0,
    name: typeof input.name === "string" ? input.name : null,
    path: typeof input.path === "string" ? input.path : null,
    state: typeof input.state === "string" ? input.state : null
  }
}

function normalizeProjectV2Summary(data: unknown): Record<string, unknown> {
  const input = typeof data === "object" && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {}

  return {
    id: typeof input.id === "string" ? input.id : null,
    title: typeof input.title === "string" ? input.title : null,
    shortDescription: typeof input.shortDescription === "string" ? input.shortDescription : null,
    public: typeof input.public === "boolean" ? input.public : null,
    closed: typeof input.closed === "boolean" ? input.closed : null,
    url: typeof input.url === "string" ? input.url : null
  }
}

function normalizeCheckItem(item: unknown): Record<string, unknown> {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return {
      name: null,
      state: null,
      bucket: null,
      workflow: null,
      link: null
    }
  }

  const input = item as Record<string, unknown>
  return {
    name: typeof input.name === "string" ? input.name : null,
    state: typeof input.state === "string" ? input.state : null,
    bucket: typeof input.bucket === "string" ? input.bucket : null,
    workflow: typeof input.workflow === "string" ? input.workflow : null,
    link: typeof input.link === "string" ? input.link : null
  }
}

function normalizeCheckBucket(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  return value.trim().toLowerCase()
}

function isCheckFailureBucket(bucket: unknown): boolean {
  const normalized = normalizeCheckBucket(bucket)
  if (!normalized) {
    return false
  }

  return normalized === "fail" || normalized === "cancel"
}

function isCheckPendingBucket(bucket: unknown): boolean {
  const normalized = normalizeCheckBucket(bucket)
  if (!normalized) {
    return false
  }

  return normalized === "pending"
}

function isCheckPassBucket(bucket: unknown): boolean {
  const normalized = normalizeCheckBucket(bucket)
  if (!normalized) {
    return false
  }

  return normalized === "pass"
}

function normalizeCliData(capabilityId: CliCapabilityId, data: unknown, params: Record<string, unknown>): unknown {
  if (capabilityId === "repo.view") {
    const input = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
    const defaultBranchRef =
      typeof input.defaultBranchRef === "object" && input.defaultBranchRef !== null
        ? (input.defaultBranchRef as Record<string, unknown>)
        : null

    return {
      id: input.id,
      name: input.name,
      nameWithOwner: input.nameWithOwner,
      isPrivate: input.isPrivate,
      stargazerCount: input.stargazerCount,
      forkCount: input.forkCount,
      url: input.url,
      defaultBranch:
        typeof defaultBranchRef?.name === "string"
          ? defaultBranchRef.name
          : null
    }
  }

  if (capabilityId === "repo.labels.list") {
    const labels = Array.isArray(data) ? data : []
    return {
      items: labels.map((label) => {
        if (typeof label !== "object" || label === null || Array.isArray(label)) {
          return {
            id: null,
            name: null,
            description: null,
            color: null,
            isDefault: null
          }
        }

        const record = label as Record<string, unknown>
        return {
          id: typeof record.id === "string" ? record.id : null,
          name: typeof record.name === "string" ? record.name : null,
          description: typeof record.description === "string" ? record.description : null,
          color: typeof record.color === "string" ? record.color : null,
          isDefault: typeof record.isDefault === "boolean" ? record.isDefault : null
        }
      }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    }
  }

  if (capabilityId === "repo.issue_types.list") {
    const root = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
    const payload = typeof root.data === "object" && root.data !== null && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : {}
    const repository = typeof payload.repository === "object" && payload.repository !== null && !Array.isArray(payload.repository)
      ? (payload.repository as Record<string, unknown>)
      : {}
    const connection = typeof repository.issueTypes === "object" && repository.issueTypes !== null && !Array.isArray(repository.issueTypes)
      ? (repository.issueTypes as Record<string, unknown>)
      : {}
    const nodes = Array.isArray(connection.nodes) ? connection.nodes : []
    const pageInfo = typeof connection.pageInfo === "object" && connection.pageInfo !== null && !Array.isArray(connection.pageInfo)
      ? (connection.pageInfo as Record<string, unknown>)
      : {}

    return {
      items: nodes.map((node) => {
        if (typeof node !== "object" || node === null || Array.isArray(node)) {
          return {
            id: null,
            name: null,
            color: null,
            isEnabled: null
          }
        }

        const record = node as Record<string, unknown>
        return {
          id: typeof record.id === "string" ? record.id : null,
          name: typeof record.name === "string" ? record.name : null,
          color: typeof record.color === "string" ? record.color : null,
          isEnabled: typeof record.isEnabled === "boolean" ? record.isEnabled : null
        }
      }),
      pageInfo: {
        hasNextPage: typeof pageInfo.hasNextPage === "boolean" ? pageInfo.hasNextPage : false,
        endCursor: typeof pageInfo.endCursor === "string" ? pageInfo.endCursor : null
      }
    }
  }

  if (capabilityId === "issue.list" || capabilityId === "pr.list") {
    const items = Array.isArray(data) ? data.map((entry) => normalizeListItem(entry)) : []
    return {
      items,
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    }
  }

  if (capabilityId === "issue.comments.list") {
    if (parseStrictPositiveInt(params.first) === null) {
      throw new Error("Missing or invalid first for issue.comments.list")
    }

    const input = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
    const commentsConnection =
      typeof input.data === "object" && input.data !== null && !Array.isArray(input.data)
        ? (input.data as Record<string, unknown>).repository
        : null
    const repository =
      typeof commentsConnection === "object" && commentsConnection !== null && !Array.isArray(commentsConnection)
        ? (commentsConnection as Record<string, unknown>)
        : null
    const issue =
      typeof repository?.issue === "object" && repository.issue !== null && !Array.isArray(repository.issue)
        ? (repository.issue as Record<string, unknown>)
        : null
    const comments =
      typeof issue?.comments === "object" && issue.comments !== null && !Array.isArray(issue.comments)
        ? (issue.comments as Record<string, unknown>)
        : null
    const nodes = Array.isArray(comments?.nodes) ? comments.nodes : null
    const pageInfo =
      typeof comments?.pageInfo === "object" && comments.pageInfo !== null && !Array.isArray(comments.pageInfo)
        ? (comments.pageInfo as Record<string, unknown>)
        : null

    if (nodes === null || pageInfo === null || typeof pageInfo.hasNextPage !== "boolean") {
      throw new Error("Invalid CLI payload: comments connection is malformed")
    }

    const normalizedItems = nodes.flatMap((comment) => {
      if (typeof comment !== "object" || comment === null || Array.isArray(comment)) {
        throw new Error("Invalid CLI payload: comment item must be an object")
      }

      const commentRecord = comment as Record<string, unknown>
      const author =
        typeof commentRecord.author === "object" && commentRecord.author !== null
          ? (commentRecord.author as Record<string, unknown>)
          : null

      if (
        typeof commentRecord.id !== "string" ||
        typeof commentRecord.body !== "string" ||
        typeof commentRecord.url !== "string" ||
        typeof commentRecord.createdAt !== "string"
      ) {
        throw new Error("Invalid CLI payload: comment item has invalid field types")
      }

      return [{
        id: commentRecord.id,
        body: commentRecord.body,
        authorLogin: typeof author?.login === "string" ? author.login : null,
        url: commentRecord.url,
        createdAt: commentRecord.createdAt
      }]
    })

    return {
      items: normalizedItems,
      pageInfo: {
        hasNextPage: pageInfo.hasNextPage,
        endCursor: typeof pageInfo.endCursor === "string" ? pageInfo.endCursor : null
      }
    }
  }

  if (capabilityId === "pr.status.checks" || capabilityId === "pr.checks.get_failed") {
    const checks = Array.isArray(data) ? data.map((entry) => normalizeCheckItem(entry)) : []
    const failed = checks.filter((entry) => isCheckFailureBucket(entry.bucket))
    const pending = checks.filter((entry) => isCheckPendingBucket(entry.bucket))
    const passed = checks.filter((entry) => isCheckPassBucket(entry.bucket))

    return {
      items: capabilityId === "pr.checks.get_failed" ? failed : checks,
      summary: {
        total: checks.length,
        failed: failed.length,
        pending: pending.length,
        passed: passed.length
      }
    }
  }

  if (capabilityId === "pr.mergeability.view") {
    const input = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}

    return {
      mergeable: typeof input.mergeable === "string" ? input.mergeable : null,
      mergeStateStatus: typeof input.mergeStateStatus === "string" ? input.mergeStateStatus : null,
      reviewDecision: typeof input.reviewDecision === "string" ? input.reviewDecision : null,
      isDraft: Boolean(input.isDraft),
      state: typeof input.state === "string" ? input.state : "UNKNOWN"
    }
  }

  if (capabilityId === "pr.ready_for_review.set") {
    const prNumber = Number(params.prNumber)
    const ready = Boolean(params.ready)

    return {
      prNumber,
      isDraft: !ready
    }
  }

  if (capabilityId === "check_run.annotations.list") {
    const annotations = Array.isArray(data) ? data : []

    return {
      items: annotations.map((annotation) => {
        if (typeof annotation !== "object" || annotation === null || Array.isArray(annotation)) {
          return {
            path: null,
            startLine: null,
            endLine: null,
            level: null,
            message: null,
            title: null,
            details: null
          }
        }

        const record = annotation as Record<string, unknown>
        return {
          path: typeof record.path === "string" ? record.path : null,
          startLine: typeof record.start_line === "number" ? record.start_line : null,
          endLine: typeof record.end_line === "number" ? record.end_line : null,
          level: typeof record.annotation_level === "string" ? record.annotation_level : null,
          message: typeof record.message === "string" ? record.message : null,
          title: typeof record.title === "string" ? record.title : null,
          details: typeof record.raw_details === "string" ? record.raw_details : null
        }
      })
    }
  }

  if (capabilityId === "workflow_runs.list") {
    const runs = Array.isArray(data) ? data : []

    return {
      items: runs.map((run) => {
        if (typeof run !== "object" || run === null || Array.isArray(run)) {
          return {
            id: 0,
            workflowName: null,
            status: null,
            conclusion: null,
            headBranch: null,
            url: null
          }
        }

        const record = run as Record<string, unknown>
        return {
          id: typeof record.databaseId === "number" ? record.databaseId : 0,
          workflowName: typeof record.workflowName === "string" ? record.workflowName : null,
          status: typeof record.status === "string" ? record.status : null,
          conclusion: typeof record.conclusion === "string" ? record.conclusion : null,
          headBranch: typeof record.headBranch === "string" ? record.headBranch : null,
          url: typeof record.url === "string" ? record.url : null
        }
      }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    }
  }

  if (capabilityId === "workflow_run.jobs.list") {
    const root = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
    const jobs = Array.isArray(root.jobs) ? root.jobs : []

    return {
      items: jobs.map((job) => {
        if (typeof job !== "object" || job === null || Array.isArray(job)) {
          return {
            id: 0,
            name: null,
            status: null,
            conclusion: null,
            startedAt: null,
            completedAt: null,
            url: null
          }
        }

        const record = job as Record<string, unknown>
        return {
          id: typeof record.databaseId === "number" ? record.databaseId : 0,
          name: typeof record.name === "string" ? record.name : null,
          status: typeof record.status === "string" ? record.status : null,
          conclusion: typeof record.conclusion === "string" ? record.conclusion : null,
          startedAt: typeof record.startedAt === "string" ? record.startedAt : null,
          completedAt: typeof record.completedAt === "string" ? record.completedAt : null,
          url: typeof record.url === "string" ? record.url : null
        }
      })
    }
  }

  if (capabilityId === "workflow_job.logs.get") {
    const jobId = Number(params.jobId)

    const rawLog = typeof data === "string" ? data : String(data)
    const truncated = rawLog.length > MAX_WORKFLOW_JOB_LOG_CHARS

    return {
      jobId,
      log: truncated ? rawLog.slice(0, MAX_WORKFLOW_JOB_LOG_CHARS) : rawLog,
      truncated
    }
  }

  if (capabilityId === "workflow_job.logs.analyze") {
    const jobId = Number(params.jobId)

    const rawLog = typeof data === "string" ? data : String(data)
    const truncated = rawLog.length > MAX_WORKFLOW_JOB_LOG_CHARS
    const boundedLog = truncated ? rawLog.slice(0, MAX_WORKFLOW_JOB_LOG_CHARS) : rawLog

    const lines = boundedLog.split(/\r?\n/)
    const errorLines = lines.filter((line) => /\berror\b/i.test(line))
    const topErrorLines = errorLines.slice(0, 10)
    const warningLines = lines.filter((line) => /\bwarn(ing)?\b/i.test(line))

    return {
      jobId,
      truncated,
      summary: {
        errorCount: errorLines.length,
        warningCount: warningLines.length,
        topErrorLines
      }
    }
  }

  if (capabilityId === "workflow.list") {
    const workflows = Array.isArray(data) ? data : []
    return {
      items: workflows.map((workflow) => normalizeWorkflowItem(workflow)),
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    }
  }

  if (capabilityId === "workflow.get") {
    const input = normalizeWorkflowItem(data)
    const root = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}

    return {
      ...input,
      url: typeof root.url === "string" ? root.url : null
    }
  }

  if (capabilityId === "workflow_run.get") {
    const input = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}

    return {
      id: typeof input.databaseId === "number" ? input.databaseId : 0,
      workflowName: typeof input.workflowName === "string" ? input.workflowName : null,
      status: typeof input.status === "string" ? input.status : null,
      conclusion: typeof input.conclusion === "string" ? input.conclusion : null,
      headBranch: typeof input.headBranch === "string" ? input.headBranch : null,
      headSha: typeof input.headSha === "string" ? input.headSha : null,
      event: typeof input.event === "string" ? input.event : null,
      createdAt: typeof input.createdAt === "string" ? input.createdAt : null,
      updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : null,
      startedAt: typeof input.startedAt === "string" ? input.startedAt : null,
      url: typeof input.url === "string" ? input.url : null
    }
  }

  if (capabilityId === "workflow_run.rerun_all") {
    return {
      runId: Number(params.runId),
      status: "requested"
    }
  }

  if (capabilityId === "workflow_run.cancel") {
    return {
      runId: Number(params.runId),
      status: "cancel_requested"
    }
  }

  if (capabilityId === "workflow_run.artifacts.list") {
    const root = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
    const artifacts = Array.isArray(root.artifacts) ? root.artifacts : []

    return {
      items: artifacts.map((artifact) => {
        if (typeof artifact !== "object" || artifact === null || Array.isArray(artifact)) {
          return {
            id: 0,
            name: null,
            sizeInBytes: null,
            archiveDownloadUrl: null
          }
        }

        const record = artifact as Record<string, unknown>
        return {
          id: typeof record.id === "number" ? record.id : 0,
          name: typeof record.name === "string" ? record.name : null,
          sizeInBytes: typeof record.sizeInBytes === "number" ? record.sizeInBytes : null,
          archiveDownloadUrl: typeof record.archiveDownloadUrl === "string" ? record.archiveDownloadUrl : null
        }
      }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    }
  }

  if (capabilityId === "project_v2.org.get" || capabilityId === "project_v2.user.get") {
    return normalizeProjectV2Summary(data)
  }

  if (capabilityId === "project_v2.fields.list") {
    const root = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
    const fields = Array.isArray(root.fields) ? root.fields : []

    return {
      items: fields.map((field) => {
        if (typeof field !== "object" || field === null || Array.isArray(field)) {
          return {
            id: null,
            name: null,
            dataType: null
          }
        }

        const record = field as Record<string, unknown>
        return {
          id: typeof record.id === "string" ? record.id : null,
          name: typeof record.name === "string" ? record.name : null,
          dataType: typeof record.dataType === "string" ? record.dataType : null
        }
      }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    }
  }

  if (capabilityId === "project_v2.items.list") {
    const root = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
    const items = Array.isArray(root.items) ? root.items : []

    return {
      items: items.map((item) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          return {
            id: null,
            contentType: null,
            contentNumber: null,
            contentTitle: null
          }
        }

        const record = item as Record<string, unknown>
        const content = typeof record.content === "object" && record.content !== null && !Array.isArray(record.content)
          ? (record.content as Record<string, unknown>)
          : {}

        return {
          id: typeof record.id === "string" ? record.id : null,
          contentType: typeof content.type === "string" ? content.type : null,
          contentNumber: typeof content.number === "number" ? content.number : null,
          contentTitle: typeof content.title === "string" ? content.title : null
        }
      }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    }
  }

  if (capabilityId === "project_v2.item.add_issue") {
    const root = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}

    return {
      itemId: typeof root.id === "string" ? root.id : null,
      added: true
    }
  }

  if (capabilityId === "project_v2.item.field.update") {
    return {
      itemId: parseNonEmptyString(params.itemId),
      updated: true
    }
  }

  if (capabilityId === "issue.view" || capabilityId === "pr.view") {
    return normalizeListItem(data)
  }

  return data
}

export async function runCliCapability(
  runner: CliCommandRunner,
  capabilityId: CliCapabilityId,
  params: Record<string, unknown>,
  card?: OperationCard
): Promise<ResultEnvelope> {
  try {
    const args = buildArgs(capabilityId, params, card)
    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId, exitCode: result.exitCode }
        },
        "cli",
        { capabilityId, reason: "CARD_FALLBACK" }
      )
    }

    const data =
      capabilityId === "workflow_job.logs.get" || capabilityId === "workflow_job.logs.analyze"
        ? result.stdout
        : parseCliData(result.stdout)
    const normalized = normalizeCliData(capabilityId, data, params)
    return normalizeResult(normalized, "cli", { capabilityId, reason: "CARD_FALLBACK" })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        {
          code: errorCodes.Server,
          message: "Failed to parse CLI JSON output",
          retryable: false
        },
        "cli",
        { capabilityId, reason: "CARD_FALLBACK" }
      )
    }

    if (error instanceof Error && error.message.toLowerCase().includes("invalid cli payload")) {
      return normalizeError(
        {
          code: errorCodes.Server,
          message: error.message,
          retryable: false
        },
        "cli",
        { capabilityId, reason: "CARD_FALLBACK" }
      )
    }

    if (error instanceof Error && error.message.toLowerCase().includes("invalid after cursor")) {
      return normalizeError(
        {
          code: errorCodes.Validation,
          message: error.message,
          retryable: false
        },
        "cli",
        { capabilityId, reason: "CARD_FALLBACK" }
      )
    }

    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code)
      },
      "cli",
      { capabilityId, reason: "CARD_FALLBACK" }
    )
  }
}
