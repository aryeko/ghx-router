import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { WorkflowScenario } from "@bench/domain/types.js"
import { loadFixtureManifest, resolveWorkflowFixtureBindings } from "@bench/fixture/manifest.js"
import { describe, expect, it } from "vitest"
import { makeWorkflowScenario } from "../helpers/scenario-factory.js"

function createBaseWorkflowScenario(): WorkflowScenario {
  return makeWorkflowScenario({
    id: "pr-resolve-wf-001",
    name: "PR resolve",
    prompt: "Resolve review threads on PR #{{prNumber}} in {{owner}}/{{name}}.",
    expected_capabilities: ["pr.thread.resolve"],
  })
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

  it("resolves workflow prompt and checkpoint inputs from fixture bindings", () => {
    const scenario: WorkflowScenario = {
      ...createBaseWorkflowScenario(),
      fixture: {
        bindings: {
          "input.owner": "repo.owner",
          "input.name": "repo.name",
          "input.prNumber": "resources.pr.number",
        },
      },
    }

    const resolved = resolveWorkflowFixtureBindings(scenario, {
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

    expect(resolved.prompt).toContain("aryeko")
    expect(resolved.prompt).toContain("ghx-bench-fixtures")
    expect(resolved.prompt).toContain("12")
  })

  it("returns original scenario when bindings are missing or empty", () => {
    const scenarioWithoutBindings = createBaseWorkflowScenario()

    const scenarioWithEmptyBindings: WorkflowScenario = {
      ...createBaseWorkflowScenario(),
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

    expect(resolveWorkflowFixtureBindings(scenarioWithoutBindings, manifest)).toBe(
      scenarioWithoutBindings,
    )
    expect(resolveWorkflowFixtureBindings(scenarioWithEmptyBindings, manifest)).toBe(
      scenarioWithEmptyBindings,
    )
  })

  it("throws when a binding source path does not exist", () => {
    const scenario: WorkflowScenario = {
      ...createBaseWorkflowScenario(),
      fixture: {
        bindings: {
          "input.owner": "resources.missing.value",
        },
      },
    }

    expect(() =>
      resolveWorkflowFixtureBindings(scenario, {
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

  it("rejects unsafe source binding path segments", () => {
    const scenario: WorkflowScenario = {
      ...createBaseWorkflowScenario(),
      fixture: {
        bindings: {
          "input.owner": "repo.__proto__.polluted",
        },
      },
    }

    expect(() =>
      resolveWorkflowFixtureBindings(scenario, {
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

  it("merges resolved context into checkpoint verification_input", () => {
    const scenario = makeWorkflowScenario({
      id: "pr-resolve-wf-001",
      name: "PR resolve",
      prompt: "Resolve review threads on PR #{{prNumber}} in {{owner}}/{{name}}.",
      expected_capabilities: ["pr.thread.resolve"],
      assertions: {
        expected_outcome: "success",
        checkpoints: [
          {
            name: "check-repo",
            verification_task: "repo.view",
            verification_input: { extra: "kept" },
            condition: "non_empty",
          },
        ],
      },
      fixture: {
        bindings: {
          "input.owner": "repo.owner",
          "input.name": "repo.name",
        },
      },
    })

    const resolved = resolveWorkflowFixtureBindings(scenario, {
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {},
    })

    const checkpoint = resolved.assertions.checkpoints[0]
    expect(checkpoint).toBeDefined()
    expect(checkpoint?.verification_input).toEqual(
      expect.objectContaining({
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        extra: "kept",
      }),
    )
  })
})
