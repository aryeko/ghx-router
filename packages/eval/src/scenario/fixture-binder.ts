// FixtureBindings is the structural interface the binder requires from a fixture manifest.
// FixtureManifest from src/fixture/manifest.ts satisfies this interface — callers may
// pass a FixtureManifest directly.
export interface FixtureBindings {
  readonly fixtures: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

import type { EvalScenario } from "./schema.js"

/**
 * Resolves `{{variable}}` placeholders in a scenario's prompt and checkpoint
 * inputs using values from a fixture manifest.
 *
 * Special variables derived automatically:
 * - `{{owner}}` — owner portion of the `repo` binding value
 * - `{{repo_name}}` — repo-name portion of the `repo` binding value
 * - `{{fixture_repo}}` — full `owner/repo-name` string
 *
 * Returns a new scenario object; the input is not mutated.
 *
 * @param scenario - Scenario with unresolved `{{variable}}` placeholders
 * @param bindings - Fixture manifest entries keyed by fixture name
 * @returns New scenario with all resolvable placeholders substituted
 *
 * @example
 * ```typescript
 * import { bindFixtureVariables } from "@ghx-dev/eval"
 *
 * const bound = bindFixtureVariables(scenario, manifest)
 * // bound.prompt now has {{repo}} replaced with the actual repo value
 * ```
 */
export function bindFixtureVariables(
  scenario: EvalScenario,
  manifest: FixtureBindings,
): EvalScenario {
  if (!scenario.fixture) return scenario

  const values = resolveBindings(scenario.fixture.bindings, manifest)
  const prompt = interpolate(scenario.prompt, values)
  const checkpoints = scenario.assertions.checkpoints.map((cp) => ({
    ...cp,
    input: interpolateRecord(cp.input, values),
  }))

  return {
    ...scenario,
    prompt,
    assertions: { ...scenario.assertions, checkpoints },
  }
}

function resolveBindings(
  bindings: Readonly<Record<string, string>>,
  manifest: FixtureBindings,
): Readonly<Record<string, string>> {
  const values: Record<string, string> = {}

  for (const [key, path] of Object.entries(bindings)) {
    const value = getNestedValue(manifest.fixtures, path)
    if (value === undefined) {
      throw new Error(`Fixture binding "${key}" could not be resolved from path "${path}"`)
    }
    values[key] = String(value)
  }

  // Derive owner/repo_name from any "repo" binding
  const repo = values["repo"]
  if (repo !== undefined && repo.includes("/")) {
    const slashIndex = repo.indexOf("/")
    values["owner"] = repo.slice(0, slashIndex)
    values["repo_name"] = repo.slice(slashIndex + 1)
  }

  return values
}

function interpolate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = values[key]
    if (value === undefined) {
      throw new Error(`Unresolved template variable: {{${key}}}`)
    }
    return value
  })
}

function interpolateRecord(
  record: Readonly<Record<string, unknown>>,
  values: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(record)) {
    result[k] = typeof v === "string" ? interpolate(v, values) : v
  }
  return result
}

function getNestedValue(obj: Readonly<Record<string, unknown>>, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}
