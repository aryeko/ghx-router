import { afterEach, describe, expect, it, vi } from "vitest"
import { fileURLToPath } from "node:url"

const benchmarkEntry = "../../src/cli/benchmark" + ".ts"
const checkScenariosEntry = "../../src/cli/check-scenarios" + ".ts"
const reportEntry = "../../src/cli/report" + ".ts"

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("cli direct-run guards", () => {
  const originalArgv = [...process.argv]

  afterEach(() => {
    process.argv = [...originalArgv]
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("auto-runs benchmark main when file is executed directly", async () => {
    const parseCliArgsMock = vi.fn(() => ({
      command: "run",
      mode: "ghx",
      repetitions: 1,
      scenarioFilter: null
    }))
    const runSuiteMock = vi.fn(async () => undefined)

    vi.doMock("../../src/cli/args.js", () => ({
      parseCliArgs: parseCliArgsMock
    }))
    vi.doMock("../../src/runner/suite-runner.js", () => ({
      runSuite: runSuiteMock
    }))

    process.argv = [...originalArgv]
    process.argv[1] = fileURLToPath(new URL(benchmarkEntry, import.meta.url))

    await import("../../src/cli/benchmark.js")
    await flushMicrotasks()

    expect(parseCliArgsMock).toHaveBeenCalled()
    expect(runSuiteMock).toHaveBeenCalledWith({
      mode: "ghx",
      repetitions: 1,
      scenarioFilter: null
    })
  })

  it("logs and exits when benchmark direct run fails", async () => {
    const parseCliArgsMock = vi.fn(() => {
      throw new Error("bad args")
    })

    vi.doMock("../../src/cli/args.js", () => ({
      parseCliArgs: parseCliArgsMock
    }))
    vi.doMock("../../src/runner/suite-runner.js", () => ({
      runSuite: vi.fn(async () => undefined)
    }))

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

    process.argv = [...originalArgv]
    process.argv[1] = fileURLToPath(new URL(benchmarkEntry, import.meta.url))

    await import("../../src/cli/benchmark.js")
    await flushMicrotasks()

    expect(errorSpy).toHaveBeenCalledWith("bad args")
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it("logs and exits when check-scenarios direct run fails", async () => {
    vi.doMock("../../src/scenario/loader.js", () => ({
      loadScenarios: vi.fn(async () => {
        throw new Error("scenario load failed")
      })
    }))

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

    process.argv = [...originalArgv]
    process.argv[1] = fileURLToPath(new URL(checkScenariosEntry, import.meta.url))

    await import("../../src/cli/check-scenarios.js")
    await flushMicrotasks()

    expect(errorSpy).toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it("does not auto-run benchmark main when argv[1] is missing", async () => {
    const parseCliArgsMock = vi.fn(() => ({
      command: "run",
      mode: "ghx",
      repetitions: 1,
      scenarioFilter: null
    }))
    const runSuiteMock = vi.fn(async () => undefined)

    vi.doMock("../../src/cli/args.js", () => ({
      parseCliArgs: parseCliArgsMock
    }))
    vi.doMock("../../src/runner/suite-runner.js", () => ({
      runSuite: runSuiteMock
    }))

    process.argv = [...originalArgv]
    delete process.argv[1]

    await import("../../src/cli/benchmark.js")
    await flushMicrotasks()

    expect(parseCliArgsMock).not.toHaveBeenCalled()
    expect(runSuiteMock).not.toHaveBeenCalled()
  })

  it("logs and exits when report direct run fails", async () => {
    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>()
      return {
        ...actual,
        readdir: vi.fn(async () => []),
        readFile: vi.fn(async () => ""),
        mkdir: vi.fn(async () => undefined),
        writeFile: vi.fn(async () => undefined)
      }
    })

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

    process.argv = [...originalArgv]
    process.argv[1] = fileURLToPath(new URL(reportEntry, import.meta.url))

    await import("../../src/cli/report.js")
    await flushMicrotasks()

    expect(errorSpy).toHaveBeenCalledWith("No benchmark result rows found")
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
