import { afterEach, describe, expect, it, vi } from "vitest"

const buildIterReportMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    generatedAt: "2026-02-23T00:00:00.000Z",
    ghxRunDir: "/runs/ghx",
    adRunDir: "/runs/ad",
    pairs: [],
    scenarioSummaries: [],
  }),
)
const formatIterReportMock = vi.hoisted(() => vi.fn().mockReturnValue("# Iter Report"))
const writeFileMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mkdirMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock("@bench/report/iter-report.js", () => ({
  buildIterReport: buildIterReportMock,
  formatIterReport: formatIterReportMock,
}))

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return {
    ...actual,
    writeFile: writeFileMock,
    mkdir: mkdirMock,
  }
})

describe("report-iter-command main", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("throws when no args provided", async () => {
    const { main } = await import("@bench/cli/report-iter-command.js")

    await expect(main([])).rejects.toThrow("Usage:")
  })

  it("throws when only one arg provided", async () => {
    const { main } = await import("@bench/cli/report-iter-command.js")

    await expect(main(["/runs/ghx"])).rejects.toThrow("Usage:")
  })

  it("calls buildIterReport with the two run dirs", async () => {
    const { main } = await import("@bench/cli/report-iter-command.js")

    await main(["/runs/ghx", "/runs/ad"])

    expect(buildIterReportMock).toHaveBeenCalledWith("/runs/ghx", "/runs/ad")
  })

  it("writes to --output path when provided", async () => {
    const { main } = await import("@bench/cli/report-iter-command.js")

    await main(["/runs/ghx", "/runs/ad", "--output", "/out/report.md"])

    expect(mkdirMock).toHaveBeenCalledWith("/out", { recursive: true })
    expect(writeFileMock).toHaveBeenCalledWith("/out/report.md", "# Iter Report\n", "utf8")
  })

  it("writes to stdout when --output omitted", async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
    const { main } = await import("@bench/cli/report-iter-command.js")

    await main(["/runs/ghx", "/runs/ad"])

    expect(writeFileMock).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).toHaveBeenCalledWith("# Iter Report\n")

    stdoutWriteSpy.mockRestore()
  })
})
