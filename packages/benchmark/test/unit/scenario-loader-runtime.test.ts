import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { loadScenarios } from "../../src/scenario/loader.js"

describe("loadScenarios", () => {
  it("loads and sorts valid scenario files", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-scenarios-"))
    await mkdir(root, { recursive: true })

    const s1 = {
      id: "b",
      name: "Scenario B",
      task: "repo.view",
      input: { owner: "a", name: "b" },
      prompt_template: "x",
      timeout_ms: 1000,
      allowed_retries: 0,
      assertions: { must_succeed: true },
      tags: []
    }
    const s2 = { ...s1, id: "a", name: "Scenario A" }

    await writeFile(join(root, "b.json"), JSON.stringify(s1), "utf8")
    await writeFile(join(root, "a.json"), JSON.stringify(s2), "utf8")
    await writeFile(join(root, "README.txt"), "ignore", "utf8")

    const scenarios = await loadScenarios(root)
    expect(scenarios.map((s) => s.id)).toEqual(["a", "b"])
  })
})
