import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadScenarioSets, loadScenarios } from "@bench/scenario/loader.js"
import { describe, expect, it } from "vitest"

describe("loadScenarios", () => {
  it("loads and sorts valid scenario files", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-scenarios-"))
    await mkdir(root, { recursive: true })

    const s1 = {
      type: "workflow",
      id: "batch-z-loader-b-wf-001",
      name: "Scenario B",
      prompt: "Do something with repository B.",
      expected_capabilities: ["repo.view"],
      timeout_ms: 1000,
      allowed_retries: 0,
      assertions: {
        expected_outcome: "success",
        checkpoints: [
          {
            name: "check",
            verification_task: "repo.view",
            verification_input: { owner: "a", name: "b" },
            condition: "non_empty",
          },
        ],
      },
      tags: [],
    }
    const s2 = { ...s1, id: "batch-z-loader-a-wf-001", name: "Scenario A" }

    await writeFile(join(root, "b.json"), JSON.stringify(s1), "utf8")
    await writeFile(join(root, "a.json"), JSON.stringify(s2), "utf8")
    await writeFile(join(root, "README.txt"), "ignore", "utf8")

    const scenarios = await loadScenarios(root)
    expect(scenarios.map((s) => s.id)).toEqual([
      "batch-z-loader-a-wf-001",
      "batch-z-loader-b-wf-001",
    ])
  })

  it("recursively loads scenarios from subdirectories", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-recursive-scenarios-"))
    await mkdir(join(root, "subdir"), { recursive: true })
    await mkdir(join(root, "subdir", "nested"), { recursive: true })

    const baseScenario = {
      type: "workflow",
      name: "Scenario",
      prompt: "Do something.",
      expected_capabilities: ["repo.view"],
      timeout_ms: 1000,
      allowed_retries: 0,
      assertions: {
        expected_outcome: "success",
        checkpoints: [
          {
            name: "check",
            verification_task: "repo.view",
            verification_input: { owner: "a", name: "b" },
            condition: "non_empty",
          },
        ],
      },
      tags: [],
    }

    await writeFile(
      join(root, "root.json"),
      JSON.stringify({ ...baseScenario, id: "root-wf-001" }),
      "utf8",
    )
    await writeFile(
      join(root, "subdir", "sub.json"),
      JSON.stringify({ ...baseScenario, id: "sub-wf-001" }),
      "utf8",
    )
    await writeFile(
      join(root, "subdir", "nested", "deep.json"),
      JSON.stringify({ ...baseScenario, id: "deep-wf-001" }),
      "utf8",
    )

    const scenarios = await loadScenarios(root)
    expect(scenarios).toHaveLength(3)
    expect(scenarios.map((s) => s.id)).toEqual(["deep-wf-001", "root-wf-001", "sub-wf-001"])
  })

  it("sorts scenarios by id across all directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-sort-scenarios-"))
    await mkdir(join(root, "alpha"), { recursive: true })
    await mkdir(join(root, "zeta"), { recursive: true })

    const baseScenario = {
      type: "workflow",
      name: "Scenario",
      prompt: "Do something.",
      expected_capabilities: ["repo.view"],
      timeout_ms: 1000,
      allowed_retries: 0,
      assertions: {
        expected_outcome: "success",
        checkpoints: [
          {
            name: "check",
            verification_task: "repo.view",
            verification_input: { owner: "a", name: "b" },
            condition: "non_empty",
          },
        ],
      },
      tags: [],
    }

    await writeFile(
      join(root, "zeta", "z.json"),
      JSON.stringify({ ...baseScenario, id: "zzzz-wf-001" }),
      "utf8",
    )
    await writeFile(
      join(root, "alpha", "a.json"),
      JSON.stringify({ ...baseScenario, id: "aaaa-wf-001" }),
      "utf8",
    )
    await writeFile(
      join(root, "m.json"),
      JSON.stringify({ ...baseScenario, id: "mmmm-wf-001" }),
      "utf8",
    )

    const scenarios = await loadScenarios(root)
    expect(scenarios.map((s) => s.id)).toEqual(["aaaa-wf-001", "mmmm-wf-001", "zzzz-wf-001"])
  })

  it("ignores non-json files in subdirectories", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-ignore-files-"))
    await mkdir(join(root, "subdir"), { recursive: true })

    const scenario = {
      type: "workflow",
      id: "test-wf-001",
      name: "Scenario",
      prompt: "Do something.",
      expected_capabilities: ["repo.view"],
      timeout_ms: 1000,
      allowed_retries: 0,
      assertions: {
        expected_outcome: "success",
        checkpoints: [
          {
            name: "check",
            verification_task: "repo.view",
            verification_input: { owner: "a", name: "b" },
            condition: "non_empty",
          },
        ],
      },
      tags: [],
    }

    await writeFile(join(root, "valid.json"), JSON.stringify(scenario), "utf8")
    await writeFile(join(root, "subdir", "README.md"), "Readme content", "utf8")
    await writeFile(join(root, "subdir", "config.yaml"), "yaml: content", "utf8")

    const scenarios = await loadScenarios(root)
    expect(scenarios).toHaveLength(1)
    expect(scenarios[0]?.id).toBe("test-wf-001")
  })

  it("handles empty directories gracefully", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-empty-dirs-"))
    await mkdir(join(root, "empty-subdir"), { recursive: true })
    await mkdir(join(root, "empty-subdir", "nested-empty"), { recursive: true })

    const scenarios = await loadScenarios(root)
    expect(scenarios).toHaveLength(0)
  })

  it("loads scenario sets manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-scenario-sets-"))
    await mkdir(root, { recursive: true })

    const manifest = {
      default: ["repo-view-001"],
      "pr-operations-all": ["repo-view-001", "pr-view-001"],
    }

    await writeFile(join(root, "scenario-sets.json"), JSON.stringify(manifest), "utf8")

    const sets = await loadScenarioSets(root)
    expect(sets).toEqual(manifest)
  })

  it("throws when scenario set manifest is not an object", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-scenario-sets-invalid-root-"))
    await mkdir(root, { recursive: true })
    await writeFile(join(root, "scenario-sets.json"), JSON.stringify(["default"]), "utf8")

    await expect(loadScenarioSets(root)).rejects.toThrow(
      "Invalid scenario-sets manifest: expected object",
    )
  })

  it("throws when scenario set contains non-string ids", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-scenario-sets-invalid-ids-"))
    await mkdir(root, { recursive: true })
    await writeFile(
      join(root, "scenario-sets.json"),
      JSON.stringify({ default: ["repo-view-001", 123], "pr-operations-all": ["repo-view-001"] }),
      "utf8",
    )

    await expect(loadScenarioSets(root)).rejects.toThrow(
      "Invalid scenario-sets manifest: set 'default' must be an array of non-empty scenario ids",
    )
  })
})
