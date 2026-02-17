import { readFile } from "node:fs/promises"
import { z } from "zod"

import type { AtomicScenario, FixtureManifest, WorkflowScenario } from "../domain/types.js"

const fixtureManifestSchema = z.object({
  version: z.literal(1),
  repo: z.object({
    owner: z.string().min(1),
    name: z.string().min(1),
    full_name: z.string().min(1),
    default_branch: z.string().min(1),
  }),
  resources: z.record(z.string(), z.unknown()),
})

const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"])

function parseBindingPath(path: string, pathLabel: "source" | "destination"): string[] {
  const segments = path.split(".")
  for (const segment of segments) {
    if (!segment) {
      throw new Error(`invalid ${pathLabel} path: ${path}`)
    }
    if (UNSAFE_PATH_SEGMENTS.has(segment)) {
      throw new Error(`unsafe fixture manifest path segment: ${segment}`)
    }
  }

  return segments
}

function getPathValue(root: Record<string, unknown>, path: string): unknown {
  const segments = parseBindingPath(path, "source")
  let cursor: unknown = root

  for (const segment of segments) {
    if (
      typeof cursor !== "object" ||
      cursor === null ||
      Array.isArray(cursor) ||
      !Object.hasOwn(cursor, segment)
    ) {
      throw new Error(`fixture manifest path not found: ${path}`)
    }
    cursor = (cursor as Record<string, unknown>)[segment]
  }

  return cursor
}

function setPathValue(root: Record<string, unknown>, path: string, value: unknown): void {
  const segments = parseBindingPath(path, "destination")
  let cursor: Record<string, unknown> = root

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    if (!segment) {
      throw new Error(`invalid destination path: ${path}`)
    }

    const isLeaf = index === segments.length - 1
    if (isLeaf) {
      cursor[segment] = value
      return
    }

    const current = cursor[segment]
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      cursor[segment] = {}
    }
    cursor = cursor[segment] as Record<string, unknown>
  }
}

export async function loadFixtureManifest(path: string): Promise<FixtureManifest> {
  const raw = await readFile(path, "utf8")
  return fixtureManifestSchema.parse(JSON.parse(raw)) as FixtureManifest
}

export function resolveScenarioFixtureBindings(
  scenario: AtomicScenario,
  manifest: FixtureManifest,
): AtomicScenario {
  const bindings = scenario.fixture?.bindings
  if (!bindings || Object.keys(bindings).length === 0) {
    return scenario
  }

  const resolvedInput: Record<string, unknown> = JSON.parse(JSON.stringify(scenario.input))
  const manifestRecord = manifest as unknown as Record<string, unknown>

  for (const [destination, source] of Object.entries(bindings)) {
    const sourceValue = getPathValue(manifestRecord, source)
    setPathValue(resolvedInput, destination.replace(/^input\./, ""), sourceValue)
  }

  return {
    ...scenario,
    input: resolvedInput,
  }
}

export function resolveWorkflowFixtureBindings(
  scenario: WorkflowScenario,
  manifest: FixtureManifest,
): WorkflowScenario {
  const bindings = scenario.fixture?.bindings
  if (!bindings || Object.keys(bindings).length === 0) {
    return scenario
  }

  const manifestRecord = manifest as unknown as Record<string, unknown>
  const resolvedContext: Record<string, unknown> = {}

  for (const [destination, source] of Object.entries(bindings)) {
    const sourceValue = getPathValue(manifestRecord, source)
    const key = destination.replace(/^input\./, "")
    resolvedContext[key] = sourceValue
  }

  let resolvedPrompt = scenario.prompt
  for (const [key, value] of Object.entries(resolvedContext)) {
    resolvedPrompt = resolvedPrompt.replaceAll(`{{${key}}}`, String(value))
  }

  const resolvedCheckpoints = scenario.assertions.checkpoints.map((checkpoint) => ({
    ...checkpoint,
    verification_input: { ...resolvedContext, ...checkpoint.verification_input },
  }))

  return {
    ...scenario,
    prompt: resolvedPrompt,
    assertions: {
      ...scenario.assertions,
      checkpoints: resolvedCheckpoints,
    },
  }
}
