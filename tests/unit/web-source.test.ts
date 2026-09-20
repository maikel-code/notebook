import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { extractReadableHtml, fetchPublicWebPage, normalizePublicUrl } from "@/lib/web/fetch"
import { normalizeSearchResults } from "@/lib/web/search"
import {
  PRIVATE_WEB_URL,
  PUBLIC_HTML,
  PUBLIC_WEB_RESULT,
  REDIRECT_WEB_URL,
} from "@/tests/fixtures/workspace-sources"

describe("web source helpers", () => {
  it("normalizes distinct public search results and rejects unsuitable URLs", () => {
    expect(
      normalizeSearchResults([
        { ...PUBLIC_WEB_RESULT, url: "https://Example.org/source#fragment" },
        PUBLIC_WEB_RESULT,
        { ...PUBLIC_WEB_RESULT, url: "http://example.org/plain" },
        { ...PUBLIC_WEB_RESULT, url: PRIVATE_WEB_URL },
      ]),
    ).toEqual([PUBLIC_WEB_RESULT])
    expect(normalizePublicUrl("https://example.org/source?utm_source=demo#section")).toBe(
      "https://example.org/source",
    )
    expect(() => normalizePublicUrl("https://user@example.org/secret")).toThrow("öffentliche")
    expect(() => normalizePublicUrl(PRIVATE_WEB_URL)).toThrow("öffentliche")
  })

  it("follows only validated redirects and extracts bounded readable HTML", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { headers: { location: "https://example.org/final" }, status: 302 }),
      )
      .mockResolvedValueOnce(
        new Response(PUBLIC_HTML, { headers: { "content-type": "text/html" }, status: 200 }),
      )
    const page = await fetchPublicWebPage(REDIRECT_WEB_URL, {
      fetcher,
      resolveHost: async () => ["93.184.216.34"],
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(page).toMatchObject({
      canonicalUrl: "https://example.org/final",
      title: "Öffentliche Beispielquelle",
    })
    expect(page.text).toContain("Der Mitgliedsbeitrag wird jährlich erhoben.")
    expect(
      extractReadableHtml(`<html><body>${"<p>Text</p>".repeat(20)}</body></html>`, 16),
    ).toHaveLength(16)
  })

  it("does not fetch a redirect target that resolves to a private address", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { headers: { location: PRIVATE_WEB_URL }, status: 302 }),
      )
    await expect(
      fetchPublicWebPage(REDIRECT_WEB_URL, {
        fetcher,
        resolveHost: async (hostname) =>
          hostname === "example.org" ? ["93.184.216.34"] : ["127.0.0.1"],
      }),
    ).rejects.toThrow("öffentliche")
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
