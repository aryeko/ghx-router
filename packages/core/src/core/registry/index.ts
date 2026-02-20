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
    "issue.view",
    "issue.list",
    "issue.comments.list",
    "issue.create",
    "issue.update",
    "issue.close",
    "issue.reopen",
    "issue.delete",
    "issue.labels.set",
    "issue.labels.add",
    "issue.labels.remove",
    "issue.assignees.set",
    "issue.assignees.add",
    "issue.assignees.remove",
    "issue.milestone.set",
    "issue.milestone.clear",
    "issue.comments.create",
    "issue.relations.prs.list",
    "issue.relations.view",
    "issue.relations.parent.set",
    "issue.relations.parent.remove",
    "issue.relations.blocked_by.add",
    "issue.relations.blocked_by.remove",
    "pr.view",
    "pr.list",
    "pr.create",
    "pr.update",
    "pr.threads.list",
    "pr.threads.reply",
    "pr.threads.resolve",
    "pr.threads.unresolve",
    "pr.reviews.list",
    "pr.reviews.request",
    "pr.reviews.submit",
    "pr.diff.files",
    "pr.diff.view",
    "pr.checks.list",
    "pr.checks.rerun.failed",
    "pr.checks.rerun.all",
    "pr.merge.status",
    "pr.merge",
    "pr.assignees.add",
    "pr.assignees.remove",
    "pr.branch.update",
    "workflow.list",
    "workflow.view",
    "project_v2.org.view",
    "project_v2.user.view",
    "project_v2.fields.list",
    "project_v2.items.list",
    "project_v2.items.issue.add",
    "project_v2.items.issue.remove",
    "project_v2.items.field.update",
    "release.list",
    "release.view",
    "release.create",
    "release.update",
    "release.publish",
    "workflow.dispatch",
    "workflow.job.logs.view",
    "workflow.job.logs.raw",
    "workflow.run.artifacts.list",
    "workflow.run.cancel",
    "workflow.run.rerun.all",
    "workflow.run.rerun.failed",
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
