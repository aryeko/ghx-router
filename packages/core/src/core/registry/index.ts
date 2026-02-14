import { readdirSync, readFileSync } from "node:fs"
import { dirname, extname, join } from "node:path"
import { fileURLToPath } from "node:url"

import Ajv from "ajv"
import { load as parseYaml } from "js-yaml"

import type { OperationCard } from "./types.js"
import { operationCardSchema } from "./operation-card-schema.js"

const ajv = new Ajv({ allErrors: true, strict: false })
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
    "pr.view",
    "pr.list",
    "pr.comments.list",
    "pr.reviews.list",
    "pr.diff.list_files",
    "pr.status.checks",
    "pr.checks.get_failed",
    "pr.mergeability.view",
    "pr.comment.reply",
    "pr.comment.resolve",
    "pr.comment.unresolve",
    "pr.ready_for_review.set",
    "check_run.annotations.list",
    "workflow_runs.list",
    "workflow_run.jobs.list",
    "workflow_job.logs.get",
    "workflow_job.logs.analyze",
    "workflow.list",
    "workflow.get",
    "workflow_run.get",
    "workflow_run.rerun_all",
    "workflow_run.cancel",
    "workflow_run.artifacts.list",
    "project_v2.org.get",
    "project_v2.user.get",
    "project_v2.fields.list",
    "project_v2.items.list",
    "project_v2.item.add_issue",
    "project_v2.item.field.update"
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
