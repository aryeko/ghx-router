import { readdirSync, readFileSync } from "node:fs"
import { dirname, extname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { load as parseYaml } from "js-yaml"
import { ajv } from "./ajv-instance.js"
import { operationCardSchema } from "./operation-card-schema.js"
import type { OperationCard } from "./types.js"

const validateCard = ajv.compile(operationCardSchema)

function cardDirectory(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url))
  return join(currentDir, "cards")
}

function loadCardsFromYaml(): OperationCard[] {
  const directory = cardDirectory()
  const preferredOrder = [
    "repo.view",
    "repo.labels.list",
    "repo.issue_types.list",
    "issue.triage.composite",
    "issue.update.composite",
    "issue.view",
    "issue.list",
    "issue.comments.list",
    "issue.create",
    "issue.update",
    "issue.close",
    "issue.reopen",
    "issue.delete",
    "issue.labels.update",
    "issue.labels.add",
    "issue.assignees.update",
    "issue.milestone.set",
    "issue.comments.create",
    "issue.linked_prs.list",
    "issue.relations.get",
    "issue.parent.set",
    "issue.parent.remove",
    "issue.blocked_by.add",
    "issue.blocked_by.remove",
    "pr.threads.composite",
    "pr.view",
    "pr.list",
    "pr.create",
    "pr.update",
    "pr.thread.list",
    "pr.thread.reply",
    "pr.thread.resolve",
    "pr.thread.unresolve",
    "pr.review.list",
    "pr.review.request",
    "pr.review.submit",
    "pr.diff.files",
    "pr.diff.view",
    "pr.checks.list",
    "pr.checks.failed",
    "pr.checks.rerun_failed",
    "pr.checks.rerun_all",
    "pr.merge.status",
    "pr.merge",
    "pr.assignees.update",
    "pr.branch.update",
    "check_run.annotations.list",
    "workflow.list",
    "workflow.get",
    "project_v2.org.get",
    "project_v2.user.get",
    "project_v2.fields.list",
    "project_v2.items.list",
    "project_v2.item.add_issue",
    "project_v2.item.field.update",
    "release.list",
    "release.get",
    "release.create_draft",
    "release.update",
    "release.publish_draft",
    "workflow.dispatch.run",
    "workflow.job.logs.get",
    "workflow.job.logs.raw",
    "workflow.run.artifacts.list",
    "workflow.run.cancel",
    "workflow.run.rerun_all",
    "workflow.run.rerun_failed",
    "workflow.run.view",
    "workflow.runs.list",
  ]
  const orderMap = new Map(preferredOrder.map((id, index) => [id, index]))

  const entries = readdirSync(directory)
    .filter((entry) => {
      const extension = extname(entry).toLowerCase()
      return extension === ".yaml" || extension === ".yml"
    })
    .sort((a, b) => {
      const capabilityA = a.replace(/\.ya?ml$/i, "")
      const capabilityB = b.replace(/\.ya?ml$/i, "")
      const orderA = orderMap.get(capabilityA) ?? Number.MAX_SAFE_INTEGER
      const orderB = orderMap.get(capabilityB) ?? Number.MAX_SAFE_INTEGER

      if (orderA !== orderB) {
        return orderA - orderB
      }

      return a.localeCompare(b)
    })

  return entries.map((entry): OperationCard => {
    const filePath = join(directory, entry)
    const raw = readFileSync(filePath, "utf8")
    const parsed = parseYaml(raw)
    const validation = validateOperationCard(parsed)
    if (!validation.ok) {
      throw new Error(`Invalid operation card '${entry}': ${validation.error}`)
    }

    return parsed as OperationCard
  })
}

export function validateOperationCard(card: unknown): { ok: true } | { ok: false; error: string } {
  const valid = validateCard(card)
  if (!valid) {
    const message = validateCard.errors?.[0]?.message ?? "Operation card schema validation failed"
    return { ok: false, error: message }
  }

  return { ok: true }
}

const operationCards = loadCardsFromYaml()

export function listOperationCards(): OperationCard[] {
  return [...operationCards]
}

export function getOperationCard(capabilityId: string): OperationCard | undefined {
  return operationCards.find((card) => card.capability_id === capabilityId)
}
