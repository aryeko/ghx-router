import { beforeEach, describe, expect, it, vi } from "vitest"

const readFileMock = vi.hoisted(() => vi.fn())
const createSignMock = vi.hoisted(() => vi.fn())

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
}))

vi.mock("node:crypto", () => ({
  createSign: createSignMock,
}))

import { applyFixtureAppAuthIfConfigured, mintFixtureAppToken } from "@bench/fixture/app-auth.js"

describe("fixture app auth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()

    delete process.env.BENCH_FIXTURE_GH_APP_CLIENT_ID
    delete process.env.BENCH_FIXTURE_GH_APP_PRIVATE_KEY
    delete process.env.BENCH_FIXTURE_GH_APP_PRIVATE_KEY_PATH
    delete process.env.GH_TOKEN
    delete process.env.GITHUB_TOKEN

    const chain = {
      update: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      sign: vi.fn().mockReturnValue(Buffer.from("signed")),
    }
    createSignMock.mockReturnValue(chain)
  })

  it("returns noop when fixture app auth env is not configured", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const restore = await applyFixtureAppAuthIfConfigured()

    expect(typeof restore).toBe("function")
    expect(fetchMock).not.toHaveBeenCalled()

    restore()
    expect(process.env.GH_TOKEN).toBeUndefined()
    expect(process.env.GITHUB_TOKEN).toBeUndefined()
  })

  it("returns null from mintFixtureAppToken when not configured", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const token = await mintFixtureAppToken()

    expect(token).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("throws when fixture app auth config is incomplete (client id only)", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "Iv23liABC")

    await expect(applyFixtureAppAuthIfConfigured()).rejects.toThrow(
      "Incomplete fixture app auth config",
    )
  })

  it("throws when fixture app auth config is incomplete (key only)", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", "-----BEGIN RSA PRIVATE KEY-----")

    await expect(applyFixtureAppAuthIfConfigured()).rejects.toThrow(
      "Incomplete fixture app auth config",
    )
  })
})
