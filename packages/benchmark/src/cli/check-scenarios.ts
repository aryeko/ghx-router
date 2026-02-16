import { access, readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { loadScenarioSets, loadScenarios } from "../scenario/loader.js"

export const REQUIRED_SCENARIO_SETS = [
  "default",
  "pr-operations-all",
  "pr-exec",
  "issues",
  "release-delivery",
  "workflows",
  "projects-v2",
  "all",
]

export const ROADMAP_CAPABILITIES_BY_SET: Record<string, string[]> = {
  "pr-exec": [
    "pr.review.submit_approve",
    "pr.review.submit_request_changes",
    "pr.review.submit_comment",
    "pr.merge.execute",
    "pr.checks.rerun_failed",
    "pr.checks.rerun_all",
    "pr.reviewers.request",
    "pr.assignees.update",
    "pr.branch.update",
  ],
  issues: [
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
    "issue.blocked_by.remove",
  ],
  "release-delivery": [
    "release.list",
    "release.get",
    "release.create_draft",
    "release.update",
    "release.publish_draft",
  ],
  workflows: [
    "workflow_dispatch.run",
    "workflow_run.rerun_failed",
    "workflow.list",
    "workflow.get",
    "workflow_run.get",
    "workflow_run.rerun_all",
    "workflow_run.cancel",
    "workflow_run.artifacts.list",
  ],
  "projects-v2": [
    "project_v2.org.get",
    "project_v2.user.get",
    "project_v2.fields.list",
    "project_v2.items.list",
    "project_v2.item.add_issue",
    "project_v2.item.field.update",
    "repo.labels.list",
    "repo.issue_types.list",
  ],
}

function assertNoDuplicateScenarioIds(scenarioIds: string[]): void {
  const duplicates = findDuplicates(scenarioIds)
  if (duplicates.length > 0) {
    throw new Error(`Duplicate scenario id(s): ${duplicates.join(", ")}`)
  }
}

function findDuplicates(items: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const item of items) {
    if (seen.has(item)) {
      duplicates.add(item)
    }
    seen.add(item)
  }

  return Array.from(duplicates)
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
  knownScenarioIds: Set<string>,
): void {
  for (const [setName, scenarioIds] of Object.entries(scenarioSets)) {
    const unknownScenarioIds = scenarioIds.filter((scenarioId) => !knownScenarioIds.has(scenarioId))
    if (unknownScenarioIds.length > 0) {
      throw new Error(
        `Scenario set '${setName}' references unknown scenario id(s): ${unknownScenarioIds.join(", ")}`,
      )
    }
  }
}

function assertNoOrphanScenarios(
  scenarioSets: Record<string, string[]>,
  scenarioIds: string[],
): void {
  const allReferencedIds = new Set(Object.values(scenarioSets).flat())
  const orphanIds = scenarioIds.filter((scenarioId) => !allReferencedIds.has(scenarioId))

  if (orphanIds.length > 0) {
    throw new Error(`Found orphan scenario id(s) not present in any set: ${orphanIds.join(", ")}`)
  }
}

function assertAllSetExactUnion(scenarioSets: Record<string, string[]>): void {
  const expectedIds = new Set([
    ...(scenarioSets["pr-exec"] ?? []),
    ...(scenarioSets["issues"] ?? []),
    ...(scenarioSets["release-delivery"] ?? []),
    ...(scenarioSets.workflows ?? []),
    ...(scenarioSets["projects-v2"] ?? []),
  ])
  const actualIds = new Set(scenarioSets["all"])

  const missingIds = Array.from(expectedIds).filter((id) => !actualIds.has(id))
  const extraIds = Array.from(actualIds).filter((id) => !expectedIds.has(id))

  if (missingIds.length > 0 || extraIds.length > 0) {
    throw new Error(
      `Scenario set 'all' must be exact union of roadmap batch sets (missing: ${missingIds.join(", ") || "none"}; extra: ${extraIds.join(", ") || "none"})`,
    )
  }
}

async function tryLoadRegistryCapabilityIds(benchmarkRoot: string): Promise<string[] | null> {
  const cardsDirectory = resolve(benchmarkRoot, "../core/src/core/registry/cards")

  try {
    await access(cardsDirectory)
  } catch {
    return null
  }

  const cardFiles = (await readdir(cardsDirectory))
    .filter((fileName) => fileName.endsWith(".yaml"))
    .sort((left, right) => left.localeCompare(right))
  const capabilityIds: string[] = []

  for (const cardFile of cardFiles) {
    const cardPath = resolve(cardsDirectory, cardFile)
    const cardContent = await readFile(cardPath, "utf8")
    const capabilityMatch = cardContent.match(/^capability_id:\s*([^\s]+)\s*$/m)

    if (!capabilityMatch?.[1]) {
      throw new Error(`Unable to parse capability_id from registry card: ${cardPath}`)
    }

    capabilityIds.push(capabilityMatch[1])
  }

  return capabilityIds
}

function assertNoDuplicateCapabilityIds(capabilityIds: string[]): void {
  const duplicates = findDuplicates(capabilityIds)
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate capability_id entries found in registry cards: ${duplicates.join(", ")}`,
    )
  }
}

function assertAllCapabilitiesCoveredByBenchmarks(
  scenarioTasks: Set<string>,
  capabilityIds: string[],
): void {
  const capabilitySet = new Set(capabilityIds)
  const missingCapabilityIds = capabilityIds.filter(
    (capabilityId) => !scenarioTasks.has(capabilityId),
  )
  const unknownScenarioTasks = Array.from(scenarioTasks).filter((task) => !capabilitySet.has(task))

  if (missingCapabilityIds.length > 0) {
    throw new Error(
      `Missing benchmark coverage for capabilities: ${missingCapabilityIds.join(", ")}`,
    )
  }

  if (unknownScenarioTasks.length > 0) {
    throw new Error(
      `Scenario tasks not present in capability registry: ${unknownScenarioTasks.join(", ")}`,
    )
  }
}

function assertRoadmapBatchCoverage(
  scenarioSets: Record<string, string[]>,
  scenariosById: Map<string, { task: string }>,
): void {
  for (const [setName, requiredCapabilities] of Object.entries(ROADMAP_CAPABILITIES_BY_SET)) {
    const coveredCapabilities = new Set(
      (scenarioSets[setName] ?? [])
        .map((scenarioId) => scenariosById.get(scenarioId)?.task)
        .filter((task): task is string => typeof task === "string"),
    )

    const missingCapabilities = requiredCapabilities.filter(
      (capability) => !coveredCapabilities.has(capability),
    )
    if (missingCapabilities.length > 0) {
      throw new Error(
        `Scenario set '${setName}' is missing capability coverage for: ${missingCapabilities.join(", ")}`,
      )
    }
  }
}

function assertCiSetsAvoidMutationScenarios(
  scenarioSets: Record<string, string[]>,
  scenariosById: Map<string, { tags: string[] }>,
): void {
  const ciSetNames = ["ci-verify-pr", "ci-verify-release"]

  for (const setName of ciSetNames) {
    const scenarioIds = scenarioSets[setName] ?? []
    const mutationScenarioIds = scenarioIds.filter((scenarioId) => {
      const tags = scenariosById.get(scenarioId)?.tags ?? []
      return tags.some((tag) => tag === "mutation" || tag === "mutations")
    })

    if (mutationScenarioIds.length > 0) {
      throw new Error(
        `Scenario set '${setName}' must avoid mutation scenarios: ${mutationScenarioIds.join(", ")}`,
      )
    }
  }
}

function assertExpectedOutcomeCoverage(
  scenariosById: Map<
    string,
    { expectedOutcome: "success" | "expected_error"; expectedErrorCode: string | undefined }
  >,
): void {
  for (const [scenarioId, scenario] of scenariosById.entries()) {
    if (scenario.expectedOutcome === "expected_error" && !scenario.expectedErrorCode) {
      throw new Error(
        `Scenario '${scenarioId}' uses expected_outcome=expected_error but has no expected_error_code`,
      )
    }
  }
}

function assertRoadmapSetsExpectSuccessOutcomes(
  scenarioSets: Record<string, string[]>,
  scenariosById: Map<string, { expectedOutcome: "success" | "expected_error" }>,
): void {
  const roadmapSets = ["pr-exec", "issues", "release-delivery", "workflows", "projects-v2"]
  for (const setName of roadmapSets) {
    const ids = scenarioSets[setName] ?? []
    const nonSuccess = ids.filter(
      (scenarioId) => scenariosById.get(scenarioId)?.expectedOutcome !== "success",
    )
    if (nonSuccess.length > 0) {
      throw new Error(
        `Roadmap set '${setName}' contains non-success expected outcomes: ${nonSuccess.join(", ")}`,
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
  const scenarioTasks = new Set(scenarios.map((scenario) => scenario.task))
  const knownScenarioIds = new Set(scenarioIds)
  const scenariosById = new Map(
    scenarios.map((scenario) => [
      scenario.id,
      {
        task: scenario.task,
        tags: scenario.tags,
        expectedOutcome:
          scenario.assertions.expected_outcome ??
          (scenario.assertions.must_succeed === false ? "expected_error" : "success"),
        expectedErrorCode: scenario.assertions.expected_error_code,
      },
    ]),
  )

  assertNoDuplicateScenarioIds(scenarioIds)
  assertRequiredScenarioSetsExist(scenarioSets)
  assertSetReferencesAreKnown(scenarioSets, knownScenarioIds)
  assertNoOrphanScenarios(scenarioSets, scenarioIds)
  assertAllSetExactUnion(scenarioSets)
  assertRoadmapBatchCoverage(scenarioSets, scenariosById)
  assertCiSetsAvoidMutationScenarios(scenarioSets, scenariosById)
  assertExpectedOutcomeCoverage(scenariosById)
  assertRoadmapSetsExpectSuccessOutcomes(scenarioSets, scenariosById)

  const registryCapabilityIds = await tryLoadRegistryCapabilityIds(benchmarkRoot)
  if (registryCapabilityIds) {
    assertNoDuplicateCapabilityIds(registryCapabilityIds)
    assertAllCapabilitiesCoveredByBenchmarks(scenarioTasks, registryCapabilityIds)
  }

  console.log(
    `Validated ${scenarios.length} benchmark scenarios across ${Object.keys(scenarioSets).length} sets`,
  )
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
