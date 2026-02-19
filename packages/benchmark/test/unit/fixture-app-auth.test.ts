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
    vi.unstubAllGlobals()

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

  it("discovers installation id and mints token from inline key", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "Iv23liABC")
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", "line1\\nline2")
    vi.stubEnv("GH_TOKEN", "old-gh")
    vi.stubEnv("GITHUB_TOKEN", "old-github")

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ id: 67890 }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: "fixture-token" }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const restore = await applyFixtureAppAuthIfConfigured()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.github.com/app/installations")
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/app/installations/67890/access_tokens")
    expect(process.env.GH_TOKEN).toBe("fixture-token")
    expect(process.env.GITHUB_TOKEN).toBe("fixture-token")

    restore()

    expect(process.env.GH_TOKEN).toBe("old-gh")
    expect(process.env.GITHUB_TOKEN).toBe("old-github")
  })

  it("reads private key from path when inline value is missing", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "Iv23liABC")
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY_PATH", "/tmp/private-key.pem")

    readFileMock.mockResolvedValue("file-private-key")

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ id: 67890 }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: "fixture-token" }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const restore = await applyFixtureAppAuthIfConfigured()

    expect(readFileMock).toHaveBeenCalledWith("/tmp/private-key.pem", "utf8")
    expect(process.env.GH_TOKEN).toBe("fixture-token")

    restore()

    expect(process.env.GH_TOKEN).toBeUndefined()
    expect(process.env.GITHUB_TOKEN).toBeUndefined()
  })

  it("mintFixtureAppToken returns token without swapping env", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "Iv23liABC")
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", "private-key")
    vi.stubEnv("GH_TOKEN", "original-gh")

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ id: 67890 }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: "minted-token" }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const token = await mintFixtureAppToken()

    expect(token).toBe("minted-token")
    expect(process.env.GH_TOKEN).toBe("original-gh")
  })

  it("throws when installation discovery returns non-ok response", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "Iv23liABC")
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", "private-key")

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue("bad credentials"),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(applyFixtureAppAuthIfConfigured()).rejects.toThrow(
      "Failed to list app installations (401): bad credentials",
    )
  })

  it("throws when no installations are found", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "Iv23liABC")
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", "private-key")

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(applyFixtureAppAuthIfConfigured()).rejects.toThrow(
      "No installations found for the fixture GitHub App",
    )
  })

  it("throws when token minting endpoint returns non-ok response", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "Iv23liABC")
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", "private-key")

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ id: 67890 }]),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue("forbidden"),
      })
    vi.stubGlobal("fetch", fetchMock)

    await expect(applyFixtureAppAuthIfConfigured()).rejects.toThrow(
      "Failed to mint fixture app installation token (403): forbidden",
    )
  })

  it("throws when token response payload is missing token", async () => {
    vi.stubEnv("BENCH_FIXTURE_GH_APP_CLIENT_ID", "Iv23liABC")
    vi.stubEnv("BENCH_FIXTURE_GH_APP_PRIVATE_KEY", "private-key")

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ id: 67890 }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: "" }),
      })
    vi.stubGlobal("fetch", fetchMock)

    await expect(applyFixtureAppAuthIfConfigured()).rejects.toThrow(
      "Fixture app token response missing token",
    )
  })
})
