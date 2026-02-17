import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  createOpencodeMock,
  loadScenariosMock,
  loadScenarioSetsMock,
  seedFixtureManifestMock,
  appendFileMock,
  mkdirMock,
  accessMock,
  lstatSyncMock,
} = vi.hoisted(() => ({
  createOpencodeMock: vi.fn(),
  loadScenariosMock: vi.fn(),
  loadScenarioSetsMock: vi.fn(),
  seedFixtureManifestMock: vi.fn(),
  appendFileMock: vi.fn(async () => undefined),
  mkdirMock: vi.fn(async () => undefined),
  accessMock: vi.fn(async () => undefined),
  lstatSyncMock: vi.fn(),
}))

vi.mock("@opencode-ai/sdk", () => ({
  createOpencode: createOpencodeMock,
}))

vi.mock("../../src/scenario/loader.js", () => ({
  loadScenarios: loadScenariosMock,
  loadScenarioSets: loadScenarioSetsMock,
}))

vi.mock("../../src/fixture/seed.js", () => ({
  seedFixtureManifest: seedFixtureManifestMock,
}))

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return {
    ...actual,
    access: accessMock,
    appendFile: appendFileMock,
    mkdir: mkdirMock,
  }
})

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>()
  lstatSyncMock.mockImplementation(actual.lstatSync)
  return {
    ...actual,
    lstatSync: lstatSyncMock,
  }
})

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(() => ({
    status: 0,
    stdout: JSON.stringify([
      { capability_id: "repo.view", description: "Repo view" },
      { capability_id: "pr.view", description: "PR view" },
    ]),
    stderr: "",
  })),
}))

const spawnSyncMock = vi.mocked(spawnSync)

function createSessionMocks(options?: { firstPromptFails?: boolean }) {
  let promptCount = 0
  const session = {
    create: vi.fn(async () => ({ data: { id: "session-1" } })),
    promptAsync: vi.fn(async () => {
      promptCount += 1
      if (options?.firstPromptFails && promptCount === 1) {
        throw new Error("prompt failed")
      }
      return { data: {} }
    }),
    messages: vi.fn(async () => ({
      data: [
        {
          info: {
            id: "msg-1",
            sessionID: "session-1",
            role: "assistant",
            time: { created: 1, completed: 10 },
            tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 0, write: 0 } },
            cost: 0,
          },
          parts: [
            {
              type: "text",
              text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{"route_used":"graphql","attempts":[{"route":"graphql","status":"success"}]}}',
            },
            { type: "tool", tool: "api-client" },
            {
              type: "step-finish",
              reason: "done",
              tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 0, write: 0 } },
              cost: 0,
              time: { end: 10 },
            },
          ],
        },
      ],
    })),
    abort: vi.fn(async () => ({ data: {} })),
  }

  return session
}

describe("runSuite", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedFixtureManifestMock.mockReset()
    accessMock.mockResolvedValue(undefined)
    loadScenarioSetsMock.mockResolvedValue({
      default: ["repo-view-001"],
      "pr-operations-all": ["repo-view-001"],
      "pr-review-reads": [],
      "pr-thread-mutations": [],
      "ci-diagnostics": [],
      "ci-log-analysis": [],
    })
  })

  it("runs suite and appends rows", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null })

    expect(createOpencodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          instructions: expect.arrayContaining([expect.stringContaining("# ghx CLI Skill")]),
          plugin: [],
        }),
      }),
    )

    expect(mkdirMock).toHaveBeenCalled()
    expect(appendFileMock).toHaveBeenCalled()
    const appendCalls = appendFileMock.mock.calls as unknown[][]
    expect(appendCalls.length).toBeGreaterThan(0)
    const firstWrite = appendCalls[0]?.[1]
    expect(typeof firstWrite).toBe("string")
    const row = JSON.parse(firstWrite as string)
    expect(row.scenario_set).toBe("default")
    expect(close).toHaveBeenCalled()
  })

  it("resolves scenario fixture bindings from manifest", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "OWNER_PLACEHOLDER", name: "REPO_PLACEHOLDER" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: {
          repo: "aryeko/ghx-bench-fixtures",
          bindings: {
            "input.owner": "repo.owner",
            "input.name": "repo.name",
          },
        },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-"))
    const fixturePath = join(root, "fixture.json")
    await writeFile(
      fixturePath,
      JSON.stringify({
        version: 1,
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

    const mod = await import("../../src/runner/suite-runner.js")
    await mod.runSuite({
      mode: "ghx",
      repetitions: 1,
      scenarioFilter: null,
      fixtureManifestPath: fixturePath,
    })

    const promptCalls = session.promptAsync.mock.calls as unknown[][]
    const firstPromptPayload = (promptCalls[0]?.[0] ?? {}) as {
      body?: {
        parts?: Array<{ type?: string; text?: string }>
      }
    }
    const prompt = String(firstPromptPayload.body?.parts?.[0]?.text ?? "")
    expect(prompt).toContain('"owner":"aryeko"')
    expect(prompt).toContain('"name":"ghx-bench-fixtures"')
    expect(close).toHaveBeenCalled()
  })

  it("loads agent_direct instruction instead of ghx skill", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await mod.runSuite({ mode: "agent_direct", repetitions: 1, scenarioFilter: null })

    expect(createOpencodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          instructions: [
            expect.stringContaining("Use GitHub CLI (`gh`) commands directly to complete the task"),
          ],
        }),
      }),
    )
    expect(close).toHaveBeenCalled()
  })

  it("runs selected scenario set and records scenario_set metadata", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
      {
        id: "pr-view-001",
        name: "PR view",
        task: "pr.view",
        input: { owner: "a", name: "b", prNumber: 1 },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    loadScenarioSetsMock.mockResolvedValue({
      default: ["repo-view-001"],
      "pr-operations-all": ["repo-view-001", "pr-view-001"],
      "pr-review-reads": ["pr-view-001"],
      "pr-thread-mutations": [],
      "ci-diagnostics": [],
      "ci-log-analysis": [],
    })

    const mod = await import("../../src/runner/suite-runner.js")
    await mod.runSuite({
      mode: "ghx",
      repetitions: 1,
      scenarioFilter: null,
      scenarioSet: "pr-review-reads",
    })

    expect(appendFileMock).toHaveBeenCalledTimes(1)
    const appendCalls = appendFileMock.mock.calls as unknown[][]
    const firstWrite = appendCalls[0]?.[1]
    const row = JSON.parse(firstWrite as string)
    expect(row.scenario_id).toBe("pr-view-001")
    expect(row.scenario_set).toBe("pr-review-reads")
  })

  it("uses explicit provider/model/output path and supports multi-scenario filter", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
      {
        id: "pr-view-001",
        name: "PR view",
        task: "pr.view",
        input: { owner: "a", name: "b", prNumber: 1 },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const root = await mkdtemp(join(tmpdir(), "ghx-bench-output-"))
    const outFile = join(root, "custom", "suite.jsonl")

    const mod = await import("../../src/runner/suite-runner.js")
    await mod.runSuite({
      mode: "ghx",
      repetitions: 1,
      scenarioFilter: ["repo-view-001", "pr-view-001"],
      providerId: "openai",
      modelId: "gpt-5.1-codex-mini",
      outputJsonlPath: outFile,
    })

    expect(appendFileMock).toHaveBeenCalledTimes(2)
    expect(appendFileMock).toHaveBeenCalledWith(outFile, expect.any(String), "utf8")

    const appendCalls = appendFileMock.mock.calls as unknown[][]
    const firstWrite = appendCalls[0]?.[1]
    const row = JSON.parse(firstWrite as string)
    expect(row.model.provider_id).toBe("openai")
    expect(row.model.model_id).toBe("gpt-5.1-codex-mini")

    const createCalls = createOpencodeMock.mock.calls as Array<[{ config?: { model?: string } }]>
    expect(createCalls[0]?.[0]?.config?.model).toBe("openai/gpt-5.1-codex-mini")
  })

  it("lets --scenario override scenario-set selection", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await mod.runSuite({
      mode: "ghx",
      repetitions: 1,
      scenarioFilter: ["repo-view-001"],
      scenarioSet: "pr-review-reads",
    })

    const appendCalls = appendFileMock.mock.calls as unknown[][]
    const firstWrite = appendCalls[0]?.[1]
    const row = JSON.parse(firstWrite as string)
    expect(row.scenario_set).toBeNull()
  })

  it("throws for unknown scenario set name", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(
      mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null, scenarioSet: "missing" }),
    ).rejects.toThrow("Unknown scenario set: missing")
    expect(close).not.toHaveBeenCalled()
  })

  it("fails ghx runSuite early when capability preflight fails", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" } as never)
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" } as never)

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(
      mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null }),
    ).rejects.toThrow("ghx_preflight_failed")
    expect(appendFileMock).not.toHaveBeenCalled()
  })

  it("throws when scenario set references unknown scenario ids", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["missing-scenario-id"],
      "pr-operations-all": ["repo-view-001"],
      "pr-review-reads": [],
      "pr-thread-mutations": [],
      "ci-diagnostics": [],
      "ci-log-analysis": [],
    })

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(
      mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null }),
    ).rejects.toThrow("references unknown scenario id")
    expect(close).not.toHaveBeenCalled()
  })

  it("throws when selected scenario set is empty", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: [],
      "pr-operations-all": ["repo-view-001"],
      "pr-review-reads": [],
      "pr-thread-mutations": [],
      "ci-diagnostics": [],
      "ci-log-analysis": [],
    })

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(
      mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null }),
    ).rejects.toThrow("No scenarios matched filter: default")
    expect(close).not.toHaveBeenCalled()
  })

  it("fails fast when selected scenarios require fixture bindings and no manifest is available", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    accessMock.mockRejectedValueOnce(new Error("missing fixture manifest"))

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "OWNER_PLACEHOLDER", name: "REPO_PLACEHOLDER" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: {
          repo: "aryeko/ghx-bench-fixtures",
          bindings: {
            "input.owner": "repo.owner",
            "input.name": "repo.name",
          },
        },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(
      mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null }),
    ).rejects.toThrow(
      "Selected scenarios require fixture bindings but no fixture manifest was provided",
    )
  })

  it("seeds the default fixture manifest for binding scenarios when --seed-if-missing is set", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "OWNER_PLACEHOLDER", name: "REPO_PLACEHOLDER" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: {
          repo: "aryeko/ghx-bench-fixtures",
          bindings: {
            "input.owner": "repo.owner",
            "input.name": "repo.name",
          },
        },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    accessMock.mockRejectedValueOnce(new Error("missing default fixture manifest"))
    accessMock.mockRejectedValueOnce(new Error("still missing before seed"))
    seedFixtureManifestMock.mockImplementation(async ({ outFile }: { outFile: string }) => {
      await mkdir("fixtures", { recursive: true })
      await writeFile(
        outFile,
        JSON.stringify({
          version: 1,
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
    })

    const mod = await import("../../src/runner/suite-runner.js")
    await mod.runSuite({
      mode: "ghx",
      repetitions: 1,
      scenarioFilter: null,
      seedIfMissing: true,
    })

    expect(seedFixtureManifestMock).toHaveBeenCalledWith({
      repo: "aryeko/ghx-bench-fixtures",
      outFile: "fixtures/latest.json",
      seedId: "default",
    })
  })

  it("seeds a missing fixture manifest when --seed-if-missing is set", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const root = await mkdtemp(join(tmpdir(), "ghx-bench-seed-"))
    const fixturePath = join(root, "seeded-fixture.json")

    seedFixtureManifestMock.mockImplementation(async ({ outFile }: { outFile: string }) => {
      await writeFile(
        outFile,
        JSON.stringify({
          version: 1,
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
    })

    accessMock.mockRejectedValueOnce(new Error("missing fixture manifest"))

    const mod = await import("../../src/runner/suite-runner.js")
    await mod.runSuite({
      mode: "ghx",
      repetitions: 1,
      scenarioFilter: null,
      fixtureManifestPath: fixturePath,
      seedIfMissing: true,
    })

    expect(seedFixtureManifestMock).toHaveBeenCalledWith({
      repo: "aryeko/ghx-bench-fixtures",
      outFile: fixturePath,
      seedId: "default",
    })
    expect(appendFileMock).toHaveBeenCalledTimes(1)
  })

  it("throws when --seed-if-missing is set without a fixture manifest", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(
      mod.runSuite({
        mode: "ghx",
        repetitions: 1,
        scenarioFilter: null,
        seedIfMissing: true,
      }),
    ).rejects.toThrow("--seed-if-missing requires --fixture-manifest")
    expect(seedFixtureManifestMock).not.toHaveBeenCalled()
  })

  it("throws when explicit fixture manifest path does not exist and seed is disabled", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    accessMock.mockRejectedValueOnce(new Error("missing explicit manifest"))

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(
      mod.runSuite({
        mode: "ghx",
        repetitions: 1,
        scenarioFilter: null,
        fixtureManifestPath: "/tmp/does-not-exist-fixture.json",
      }),
    ).rejects.toThrow("Fixture manifest not found: /tmp/does-not-exist-fixture.json")
  })

  it("throws when scenario filter matches nothing", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })
    loadScenariosMock.mockResolvedValue([])

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(
      mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: ["none"] }),
    ).rejects.toThrow("No scenarios matched filter")
    expect(close).not.toHaveBeenCalled()
    expect(createOpencodeMock).not.toHaveBeenCalled()
  })

  it("throws when no scenarios exist without a filter", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })
    loadScenariosMock.mockResolvedValue([])

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(
      mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null }),
    ).rejects.toThrow("No benchmark scenarios found")
    expect(close).not.toHaveBeenCalled()
    expect(createOpencodeMock).not.toHaveBeenCalled()
  })

  it("retries failed scenario attempts up to allowed_retries", async () => {
    const session = createSessionMocks({ firstPromptFails: true })
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 1,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null })

    expect(session.promptAsync).toHaveBeenCalledTimes(2)
    expect(appendFileMock).toHaveBeenCalledTimes(1)
    const appendCalls = appendFileMock.mock.calls as unknown[][]
    const row = JSON.parse(String(appendCalls[0]?.[1] ?? "{}")) as {
      external_retry_count?: unknown
    }
    expect(row.external_retry_count).toBe(0)
  })

  it("preserves runner-level external retry count in persisted rows", async () => {
    const session = {
      create: vi
        .fn()
        .mockResolvedValueOnce({ data: { id: "session-1" } })
        .mockResolvedValueOnce({ data: { id: "session-2" } }),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn().mockImplementation(async (options: { path?: { id?: string } }) => {
        if (options.path?.id === "session-1") {
          return { data: [] }
        }

        return {
          data: [
            {
              info: {
                id: "msg-2",
                sessionID: "session-2",
                role: "assistant",
                time: { created: 1, completed: 10 },
                tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 0, write: 0 } },
                cost: 0,
              },
              parts: [
                {
                  type: "text",
                  text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{"route_used":"graphql"}}',
                },
                { type: "tool", tool: "api-client" },
                {
                  type: "step-finish",
                  reason: "done",
                  tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 0, write: 0 } },
                  cost: 0,
                  time: { end: 10 },
                },
              ],
            },
          ],
        }
      }),
      abort: vi.fn(async () => ({ data: {} })),
    }

    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 10,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
          require_tool_calls: false,
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await mod.runSuite({ mode: "agent_direct", repetitions: 1, scenarioFilter: null })

    expect(appendFileMock).toHaveBeenCalledTimes(1)
    const appendCalls = appendFileMock.mock.calls as unknown[][]
    const row = JSON.parse(String(appendCalls[0]?.[1] ?? "{}")) as {
      external_retry_count?: unknown
    }
    expect(row.external_retry_count).toBe(1)
  })

  it("throws if no benchmark result is produced for a scenario", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: -1,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(
      mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null }),
    ).rejects.toThrow("No benchmark result produced")
    expect(close).not.toHaveBeenCalled()
  })

  it("restores pre-existing opencode and token env vars after each isolated run", async () => {
    const previous = {
      OPENCODE_CONFIG: process.env.OPENCODE_CONFIG,
      OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
      GH_TOKEN: process.env.GH_TOKEN,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    }

    process.env.OPENCODE_CONFIG = "from-test-config"
    process.env.OPENCODE_CONFIG_DIR = "from-test-config-dir"
    process.env.XDG_CONFIG_HOME = "from-test-xdg"
    process.env.GH_TOKEN = "from-test-gh"
    process.env.GITHUB_TOKEN = "from-test-github"

    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")

    try {
      await mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null })

      expect(process.env.OPENCODE_CONFIG).toBe("from-test-config")
      expect(process.env.OPENCODE_CONFIG_DIR).toBe("from-test-config-dir")
      expect(process.env.XDG_CONFIG_HOME).toBe("from-test-xdg")
      expect(process.env.GH_TOKEN).toBe("from-test-gh")
      expect(process.env.GITHUB_TOKEN).toBe("from-test-github")
    } finally {
      if (previous.OPENCODE_CONFIG === undefined) {
        delete process.env.OPENCODE_CONFIG
      } else {
        process.env.OPENCODE_CONFIG = previous.OPENCODE_CONFIG
      }

      if (previous.OPENCODE_CONFIG_DIR === undefined) {
        delete process.env.OPENCODE_CONFIG_DIR
      } else {
        process.env.OPENCODE_CONFIG_DIR = previous.OPENCODE_CONFIG_DIR
      }

      if (previous.XDG_CONFIG_HOME === undefined) {
        delete process.env.XDG_CONFIG_HOME
      } else {
        process.env.XDG_CONFIG_HOME = previous.XDG_CONFIG_HOME
      }

      if (previous.GH_TOKEN === undefined) {
        delete process.env.GH_TOKEN
      } else {
        process.env.GH_TOKEN = previous.GH_TOKEN
      }

      if (previous.GITHUB_TOKEN === undefined) {
        delete process.env.GITHUB_TOKEN
      } else {
        process.env.GITHUB_TOKEN = previous.GITHUB_TOKEN
      }
    }
  })

  it("handles missing gh tokens and leaves env vars unset", async () => {
    const previous = {
      OPENCODE_CONFIG: process.env.OPENCODE_CONFIG,
      OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
      GH_TOKEN: process.env.GH_TOKEN,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    }

    delete process.env.OPENCODE_CONFIG
    delete process.env.OPENCODE_CONFIG_DIR
    delete process.env.XDG_CONFIG_HOME
    delete process.env.GH_TOKEN
    delete process.env.GITHUB_TOKEN

    const spawnSync = await import("node:child_process")
    vi.mocked(spawnSync.spawnSync).mockImplementation((_cmd, args) => {
      if (Array.isArray(args) && args[0] === "auth" && args[1] === "status") {
        return { status: 0, stdout: "ok", stderr: "" } as never
      }

      if (Array.isArray(args) && args[0] === "auth" && args[1] === "token") {
        return { status: 1 } as never
      }

      if (Array.isArray(args) && args.includes("capabilities") && args.includes("list")) {
        return {
          status: 0,
          stdout: JSON.stringify([{ capability_id: "repo.view", description: "Repo view" }]),
          stderr: "",
        } as never
      }

      return { status: 0 } as never
    })

    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")

    try {
      await mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null })

      expect(process.env.OPENCODE_CONFIG).toBeUndefined()
      expect(process.env.OPENCODE_CONFIG_DIR).toBeUndefined()
      expect(process.env.XDG_CONFIG_HOME).toBeUndefined()
      expect(process.env.GH_TOKEN).toBeUndefined()
      expect(process.env.GITHUB_TOKEN).toBeUndefined()
    } finally {
      if (previous.OPENCODE_CONFIG === undefined) {
        delete process.env.OPENCODE_CONFIG
      } else {
        process.env.OPENCODE_CONFIG = previous.OPENCODE_CONFIG
      }

      if (previous.OPENCODE_CONFIG_DIR === undefined) {
        delete process.env.OPENCODE_CONFIG_DIR
      } else {
        process.env.OPENCODE_CONFIG_DIR = previous.OPENCODE_CONFIG_DIR
      }

      if (previous.XDG_CONFIG_HOME === undefined) {
        delete process.env.XDG_CONFIG_HOME
      } else {
        process.env.XDG_CONFIG_HOME = previous.XDG_CONFIG_HOME
      }

      if (previous.GH_TOKEN === undefined) {
        delete process.env.GH_TOKEN
      } else {
        process.env.GH_TOKEN = previous.GH_TOKEN
      }

      if (previous.GITHUB_TOKEN === undefined) {
        delete process.env.GITHUB_TOKEN
      } else {
        process.env.GITHUB_TOKEN = previous.GITHUB_TOKEN
      }
    }
  })

  it("fails early when benchmark ghx alias symlink check fails (sync preflight)", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    lstatSyncMock.mockImplementationOnce(() => {
      throw new Error("missing alias")
    })

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(
      mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null }),
    ).rejects.toThrow("benchmark ghx alias missing")
  })

  it("fails when isolated ghx alias check fails before client execution", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    const configGet = vi.fn(async () => ({
      data: { instructions: ["# ghx CLI Skill"], plugin: [] },
    }))
    createOpencodeMock.mockResolvedValue({
      client: { session, config: { get: configGet } },
      server: { close },
    })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const fsPromises = await import("node:fs/promises")
    const lstatSpy = vi.spyOn(fsPromises, "lstat").mockRejectedValueOnce(new Error("missing alias"))

    const mod = await import("../../src/runner/suite-runner.js")
    try {
      await expect(
        mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null }),
      ).rejects.toThrow("benchmark ghx alias missing")
      expect(configGet).not.toHaveBeenCalled()
    } finally {
      lstatSpy.mockRestore()
    }
  })

  it("fails when ghx isolated client config does not include valid instructions", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({
      client: {
        session,
        config: {
          get: vi.fn(async () => ({ data: { instructions: [""], plugin: ["forbidden"] } })),
        },
      },
      server: { close },
    })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(
      mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null }),
    ).rejects.toThrow(
      "benchmark_config_invalid: expected non-empty ghx instructions and no plugins",
    )
  })

  it("fails when agent_direct isolated client config instruction is missing", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({
      client: {
        session,
        config: {
          get: vi.fn(async () => ({ data: { instructions: ["wrong"], plugin: [] } })),
        },
      },
      server: { close },
    })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(
      mod.runSuite({ mode: "agent_direct", repetitions: 1, scenarioFilter: null }),
    ).rejects.toThrow("benchmark_config_invalid: expected agent_direct instruction and no plugins")
  })

  it("restores PATH to undefined when it was unset before isolated execution", async () => {
    const previousPath = process.env.PATH
    const previousGhToken = process.env.GH_TOKEN
    const previousGithubToken = process.env.GITHUB_TOKEN

    delete process.env.PATH
    process.env.GH_TOKEN = "from-test-gh"
    process.env.GITHUB_TOKEN = "from-test-gh"

    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")

    try {
      await mod.runSuite({ mode: "agent_direct", repetitions: 1, scenarioFilter: null })
      expect(process.env.PATH).toBeUndefined()
    } finally {
      if (previousPath === undefined) {
        delete process.env.PATH
      } else {
        process.env.PATH = previousPath
      }
      if (previousGhToken === undefined) {
        delete process.env.GH_TOKEN
      } else {
        process.env.GH_TOKEN = previousGhToken
      }
      if (previousGithubToken === undefined) {
        delete process.env.GITHUB_TOKEN
      } else {
        process.env.GITHUB_TOKEN = previousGithubToken
      }
    }
  })

  it("emits JSONL suite/scenario progress events when BENCH_PROGRESS_EVENTS=jsonl", async () => {
    const previousProgressEvents = process.env.BENCH_PROGRESS_EVENTS
    process.env.BENCH_PROGRESS_EVENTS = "jsonl"

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
        },
        tags: [],
      },
    ])

    const mod = await import("../../src/runner/suite-runner.js")

    try {
      await mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null })

      const events = consoleLogSpy.mock.calls
        .map((call) => call[0])
        .filter((line): line is string => typeof line === "string")
        .map((line) => {
          try {
            return JSON.parse(line) as { event?: unknown; completed?: unknown; total?: unknown }
          } catch {
            return null
          }
        })
        .filter(
          (entry): entry is { event?: unknown; completed?: unknown; total?: unknown } =>
            entry !== null,
        )

      const eventNames = events.map((entry) => entry.event)

      expect(eventNames).toEqual([
        "suite_started",
        "scenario_started",
        "scenario_finished",
        "suite_finished",
      ])
      expect(events.find((entry) => entry.event === "suite_started")).toMatchObject({
        completed: 0,
        total: 1,
      })
    } finally {
      if (previousProgressEvents === undefined) {
        delete process.env.BENCH_PROGRESS_EVENTS
      } else {
        process.env.BENCH_PROGRESS_EVENTS = previousProgressEvents
      }
      consoleLogSpy.mockRestore()
    }
  })

  it("emits suite_error JSONL event when runSuite fails in progress mode", async () => {
    const previousProgressEvents = process.env.BENCH_PROGRESS_EVENTS
    process.env.BENCH_PROGRESS_EVENTS = "jsonl"

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })
    loadScenariosMock.mockResolvedValue([])

    const mod = await import("../../src/runner/suite-runner.js")

    try {
      await expect(
        mod.runSuite({ mode: "ghx", repetitions: 1, scenarioFilter: null }),
      ).rejects.toThrow("No benchmark scenarios found")

      const eventNames = consoleLogSpy.mock.calls
        .map((call) => call[0])
        .filter((line): line is string => typeof line === "string")
        .map((line) => {
          try {
            return JSON.parse(line) as { event?: unknown }
          } catch {
            return null
          }
        })
        .filter((entry): entry is { event?: unknown } => entry !== null)
        .map((entry) => entry.event)

      expect(eventNames).toContain("suite_error")
    } finally {
      if (previousProgressEvents === undefined) {
        delete process.env.BENCH_PROGRESS_EVENTS
      } else {
        process.env.BENCH_PROGRESS_EVENTS = previousProgressEvents
      }
      consoleLogSpy.mockRestore()
    }
  })
})
