import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { loadScenarios, loadScenarioSets } from "../scenario/loader.js"

export const REQUIRED_SCENARIO_SETS = [
  "default",
  "pr-operations-all",
  "roadmap-batch-a-pr-exec",
  "roadmap-batch-b-issues",
  "roadmap-batch-c-release-delivery",
  "roadmap-batch-d-workflow-projects-v2",
  "roadmap-all"
]

export const ROADMAP_CAPABILITIES_BY_SET: Record<string, string[]> = {
  "roadmap-batch-a-pr-exec": [
    "pr.review.submit_approve",
    "pr.review.submit_request_changes",
    "pr.review.submit_comment",
    "pr.merge.execute",
    "pr.checks.rerun_failed",
    "pr.checks.rerun_all",
    "pr.reviewers.request",
    "pr.assignees.update",
    "pr.branch.update"
  ],
  "roadmap-batch-b-issues": [
    "issue.create",
    "issue.update",
    "issue.close",
    "issue.reopen",
    "issue.delete",
    "issue.labels.update",
    "issue.assignees.update",
    "issue.milestone.set",
    "issue.comments.create",
    "issue.linked_prs.list",
    "issue.relations.get",
    "issue.parent.set",
    "issue.parent.remove",
    "issue.blocked_by.add",
    "issue.blocked_by.remove"
  ],
  "roadmap-batch-c-release-delivery": [
    "release.list",
    "release.get",
    "release.create_draft",
    "release.update",
    "release.publish_draft",
    "workflow_dispatch.run",
    "workflow_run.rerun_failed"
  ],
  "roadmap-batch-d-workflow-projects-v2": [
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
    "project_v2.item.field.update",
    "repo.labels.list",
    "repo.issue_types.list"
  ]
}

function assertNoDuplicateScenarioIds(scenarioIds: string[]): void {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const scenarioId of scenarioIds) {
    if (seen.has(scenarioId)) {
      duplicates.add(scenarioId)
    }
    seen.add(scenarioId)
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate scenario id(s): ${Array.from(duplicates).join(", ")}`)
  }
}

function assertRequiredScenarioSetsExist(scenarioSets: Record<string, string[]>): void {
  for (const setName of REQUIRED_SCENARIO_SETS) {
    if (!Object.hasOwn(scenarioSets, setName)) {
      throw new Error(`Missing required scenario set: ${setName}`)
    }
  }
}

function assertSetReferencesAreKnown(
  scenarioSets: Record<string, string[]>,
  knownScenarioIds: Set<string>
): void {
  for (const [setName, scenarioIds] of Object.entries(scenarioSets)) {
    const unknownScenarioIds = scenarioIds.filter((scenarioId) => !knownScenarioIds.has(scenarioId))
    if (unknownScenarioIds.length > 0) {
      throw new Error(`Scenario set '${setName}' references unknown scenario id(s): ${unknownScenarioIds.join(", ")}`)
    }
  }
}

function assertNoOrphanScenarios(scenarioSets: Record<string, string[]>, scenarioIds: string[]): void {
  const allReferencedIds = new Set(Object.values(scenarioSets).flat())
  const orphanIds = scenarioIds.filter((scenarioId) => !allReferencedIds.has(scenarioId))

  if (orphanIds.length > 0) {
    throw new Error(`Found orphan scenario id(s) not present in any set: ${orphanIds.join(", ")}`)
  }
}

function assertRoadmapAllExactUnion(scenarioSets: Record<string, string[]>): void {
  const expectedIds = new Set([
    ...(scenarioSets["roadmap-batch-a-pr-exec"] ?? []),
    ...(scenarioSets["roadmap-batch-b-issues"] ?? []),
    ...(scenarioSets["roadmap-batch-c-release-delivery"] ?? []),
    ...(scenarioSets["roadmap-batch-d-workflow-projects-v2"] ?? [])
  ])
  const actualIds = new Set(scenarioSets["roadmap-all"])

  const missingIds = Array.from(expectedIds).filter((id) => !actualIds.has(id))
  const extraIds = Array.from(actualIds).filter((id) => !expectedIds.has(id))

  if (missingIds.length > 0 || extraIds.length > 0) {
    throw new Error(
      `Scenario set 'roadmap-all' must be exact union of roadmap batch sets (missing: ${missingIds.join(", ") || "none"}; extra: ${extraIds.join(", ") || "none"})`
    )
  }
}

function assertRoadmapBatchCoverage(
  scenarioSets: Record<string, string[]>,
  scenariosById: Map<string, { task: string }>
): void {
  for (const [setName, requiredCapabilities] of Object.entries(ROADMAP_CAPABILITIES_BY_SET)) {
    const coveredCapabilities = new Set(
      (scenarioSets[setName] ?? [])
        .map((scenarioId) => scenariosById.get(scenarioId)?.task)
        .filter((task): task is string => typeof task === "string")
    )

    const missingCapabilities = requiredCapabilities.filter((capability) => !coveredCapabilities.has(capability))
    if (missingCapabilities.length > 0) {
      throw new Error(
        `Scenario set '${setName}' is missing capability coverage for: ${missingCapabilities.join(", ")}`
      )
    }
  }
}

export async function main(cwd: string = process.cwd()): Promise<void> {
  const scenariosDir = resolve(cwd, "scenarios")
  const benchmarkRoot = resolve(cwd)
  const scenarios = await loadScenarios(scenariosDir)
  const scenarioSets = await loadScenarioSets(benchmarkRoot)

  if (scenarios.length === 0) {
    throw new Error("No benchmark scenarios found")
  }

  const scenarioIds = scenarios.map((scenario) => scenario.id)
  const knownScenarioIds = new Set(scenarioIds)
  const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, { task: scenario.task }]))

  assertNoDuplicateScenarioIds(scenarioIds)
  assertRequiredScenarioSetsExist(scenarioSets)
  assertSetReferencesAreKnown(scenarioSets, knownScenarioIds)
  assertNoOrphanScenarios(scenarioSets, scenarioIds)
  assertRoadmapAllExactUnion(scenarioSets)
  assertRoadmapBatchCoverage(scenarioSets, scenariosById)

  console.log(`Validated ${scenarios.length} benchmark scenarios across ${Object.keys(scenarioSets).length} sets`)
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
