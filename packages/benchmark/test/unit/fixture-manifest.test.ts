import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"
import type { Scenario } from "../../src/domain/types.js"
import { loadFixtureManifest, resolveScenarioFixtureBindings } from "../../src/fixture/manifest.js"

function createBaseScenario(): Scenario {
  return {
    id: "pr-view-001",
    name: "PR view",
    task: "pr.view",
    input: {
      owner: "OWNER_PLACEHOLDER",
      name: "REPO_PLACEHOLDER",
      prNumber: 0,
      nested: "not-object",
    },
    prompt_template: "x",
    timeout_ms: 1000,
    allowed_retries: 0,
    assertions: {
      must_succeed: true,
    },
    tags: [],
  }
}

describe("fixture manifest", () => {
  it("loads and validates fixture manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-manifest-"))
    const path = join(root, "fixtures.json")
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        repo: {
          owner: "aryeko",
          name: "ghx-bench-fixtures",
          full_name: "aryeko/ghx-bench-fixtures",
          default_branch: "main",
        },
        resources: {
          pr: {
            number: 12,
          },
        },
      }),
      "utf8",
    )

    const manifest = await loadFixtureManifest(path)
    expect(manifest.repo.full_name).toBe("aryeko/ghx-bench-fixtures")
  })

  it("throws when fixture manifest is invalid json", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-manifest-invalid-json-"))
    const path = join(root, "fixtures.json")
    await writeFile(path, "{not-json", "utf8")

    await expect(loadFixtureManifest(path)).rejects.toThrow()
  })

  it("throws when fixture manifest schema is invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-manifest-invalid-schema-"))
    const path = join(root, "fixtures.json")
    await writeFile(
      path,
      JSON.stringify({
        version: 2,
        repo: {
          owner: "aryeko",
          name: "ghx-bench-fixtures",
          full_name: "aryeko/ghx-bench-fixtures",
          default_branch: "main",
        },
        resources: {},
      }),
      "utf8",
    )

    await expect(loadFixtureManifest(path)).rejects.toThrow()
  })

  it("resolves scenario input values from fixture bindings", () => {
    const scenario: Scenario = {
      ...createBaseScenario(),
      fixture: {
        bindings: {
          "input.owner": "repo.owner",
          "input.name": "repo.name",
          "input.prNumber": "resources.pr.number",
        },
      },
    }

    const resolved = resolveScenarioFixtureBindings(scenario, {
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {
        pr: {
          number: 12,
        },
      },
    })

    expect(resolved.input.owner).toBe("aryeko")
    expect(resolved.input.name).toBe("ghx-bench-fixtures")
    expect(resolved.input.prNumber).toBe(12)
  })

  it("returns original scenario when bindings are missing or empty", () => {
    const scenarioWithoutBindings: Scenario = {
      ...createBaseScenario(),
    }

    const scenarioWithEmptyBindings: Scenario = {
      ...createBaseScenario(),
      fixture: {
        bindings: {},
      },
    }

    const manifest = {
      version: 1 as const,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {},
    }

    expect(resolveScenarioFixtureBindings(scenarioWithoutBindings, manifest)).toBe(
      scenarioWithoutBindings,
    )
    expect(resolveScenarioFixtureBindings(scenarioWithEmptyBindings, manifest)).toBe(
      scenarioWithEmptyBindings,
    )
  })

  it("throws when a binding source path does not exist", () => {
    const scenario: Scenario = {
      ...createBaseScenario(),
      fixture: {
        bindings: {
          "input.owner": "resources.missing.value",
        },
      },
    }

    expect(() =>
      resolveScenarioFixtureBindings(scenario, {
        version: 1,
        repo: {
          owner: "aryeko",
          name: "ghx-bench-fixtures",
          full_name: "aryeko/ghx-bench-fixtures",
          default_branch: "main",
        },
        resources: {},
      }),
    ).toThrow("fixture manifest path not found")
  })

  it("throws when destination binding path is invalid", () => {
    const scenario: Scenario = {
      ...createBaseScenario(),
      fixture: {
        bindings: {
          "input..owner": "repo.owner",
        },
      },
    }

    expect(() =>
      resolveScenarioFixtureBindings(scenario, {
        version: 1,
        repo: {
          owner: "aryeko",
          name: "ghx-bench-fixtures",
          full_name: "aryeko/ghx-bench-fixtures",
          default_branch: "main",
        },
        resources: {},
      }),
    ).toThrow("invalid destination path")
  })

  it("replaces non-object intermediates when setting destination paths", () => {
    const scenario: Scenario = {
      ...createBaseScenario(),
      fixture: {
        bindings: {
          "input.nested.value": "repo.owner",
        },
      },
    }

    const resolved = resolveScenarioFixtureBindings(scenario, {
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {},
    })

    expect(resolved.input.nested).toEqual({ value: "aryeko" })
  })

  it("rejects unsafe source binding path segments", () => {
    const scenario: Scenario = {
      ...createBaseScenario(),
      fixture: {
        bindings: {
          "input.owner": "repo.__proto__.polluted",
        },
      },
    }

    expect(() =>
      resolveScenarioFixtureBindings(scenario, {
        version: 1,
        repo: {
          owner: "aryeko",
          name: "ghx-bench-fixtures",
          full_name: "aryeko/ghx-bench-fixtures",
          default_branch: "main",
        },
        resources: {},
      }),
    ).toThrow("unsafe fixture manifest path segment")
  })

  it("rejects unsafe destination binding path segments", () => {
    const scenario: Scenario = {
      ...createBaseScenario(),
      fixture: {
        bindings: {
          "input.__proto__.polluted": "repo.owner",
        },
      },
    }

    expect(() =>
      resolveScenarioFixtureBindings(scenario, {
        version: 1,
        repo: {
          owner: "aryeko",
          name: "ghx-bench-fixtures",
          full_name: "aryeko/ghx-bench-fixtures",
          default_branch: "main",
        },
        resources: {},
      }),
    ).toThrow("unsafe fixture manifest path segment")
  })
})
