import "server-only"

import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

import { load } from "cheerio"

import { MAX_WEB_REDIRECTS, MAX_WEB_SOURCE_BYTES, WEB_FETCH_TIMEOUT_MS } from "@/lib/limits"

export interface PublicWebPage {
  byteSize: number
  canonicalUrl: string
  text: string
  title: string
}

export interface FetchPublicWebPageOptions {
  fetcher?: typeof fetch
  maxBytes?: number
  resolveHost?: (hostname: string) => Promise<string[]>
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number)
  const first = octets[0]
  const second = octets[1]
  if (
    octets.length !== 4 ||
    first === undefined ||
    second === undefined ||
    octets.some((octet) => !Number.isInteger(octet))
  )
    return false
  if (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first === 169 ||
    first === 224 ||
    first === 255 ||
    first >= 240
  ) {
    return false
  }
  if (
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 172 && second >= 16 && second <= 31)
  )
    return false
  if (first === 192 && (second === 0 || second === 168)) return false
  if (first === 198 && (second === 18 || second === 19 || second === 51)) return false
  if (first === 203 && second === 0) return false
  return true
}

function isPublicIp(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPublicIpv4(address)
  if (version !== 6) return false
  const normalized = address.toLowerCase()
  if (normalized.startsWith("::ffff:")) return isPublicIpv4(normalized.slice(7))
  return !(
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  )
}

function stripTrackingParameters(url: URL): void {
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase()
    if (
      normalized.startsWith("utm_") ||
      ["fbclid", "gclid", "mc_cid", "mc_eid", "ref"].includes(normalized)
    ) {
      url.searchParams.delete(key)
    }
  }
}

function localE2EFetchEnabled(): boolean {
  try {
    return (
      process.env.NODE_ENV !== "production" &&
      process.env.NOTEBOOK_E2E_INGESTION_MODE === "1" &&
      ["127.0.0.1", "localhost"].includes(
        new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid").hostname,
      )
    )
  } catch {
    return false
  }
}

export function normalizePublicUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error("Die Zieladresse ist keine öffentliche HTTPS-Webseite.")
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hostname.toLowerCase() === "localhost" ||
    (isIP(url.hostname) !== 0 && !isPublicIp(url.hostname))
  ) {
    throw new Error("Die Zieladresse ist keine öffentliche HTTPS-Webseite.")
  }
  url.hash = ""
  stripTrackingParameters(url)
  return url.toString()
}

async function resolvePublicHost(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true })
  return records.map((record) => record.address)
}

async function validateResolvedAddress(
  url: string,
  resolveHost: (hostname: string) => Promise<string[]>,
): Promise<string> {
  const normalized = normalizePublicUrl(url)
  const parsed = new URL(normalized)
  const addresses = isIP(parsed.hostname) ? [parsed.hostname] : await resolveHost(parsed.hostname)
  if (!addresses.length || addresses.some((address) => !isPublicIp(address))) {
    throw new Error("Die Zieladresse ist keine öffentliche HTTPS-Webseite.")
  }
  return normalized
}

async function readBoundedResponse(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredSize = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    throw new Error("Die Webseite ist für den Import zu groß.")
  }
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) throw new Error("Die Webseite ist für den Import zu groß.")
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const content = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    content.set(chunk, offset)
    offset += chunk.byteLength
  }
  return content
}

export function extractReadableHtml(html: string, maxChars = MAX_WEB_SOURCE_BYTES): string {
  const document = load(html)
  document("script, style, noscript, svg, nav, footer, header, aside, form, iframe").remove()
  return document("main, article, body")
    .first()
    .text()
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, maxChars)
}

export async function fetchPublicWebPage(
  url: string,
  options: FetchPublicWebPageOptions = {},
): Promise<PublicWebPage> {
  const fetcher = options.fetcher ?? fetch
  const resolveHost = options.resolveHost ?? resolvePublicHost
  const maxBytes = options.maxBytes ?? MAX_WEB_SOURCE_BYTES
  if (localE2EFetchEnabled()) {
    const canonicalUrl = normalizePublicUrl(url)
    if (canonicalUrl === "https://example.org/unreadable") {
      throw new Error("Die Webseite enthält keinen lesbaren Text.")
    }
    const html =
      "<!doctype html><title>Öffentliche Beispielquelle</title><main><h1>Mitgliedschaft</h1><p>Der Mitgliedsbeitrag wird jährlich erhoben.</p><p>Eine Kündigung ist schriftlich möglich.</p></main>"
    return {
      byteSize: new TextEncoder().encode(html).byteLength,
      canonicalUrl,
      text: extractReadableHtml(html),
      title: "Öffentliche Beispielquelle",
    }
  }
  let target = await validateResolvedAddress(url, resolveHost)

  for (let redirects = 0; redirects <= MAX_WEB_REDIRECTS; redirects += 1) {
    const response = await fetcher(target, {
      headers: { accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      signal: AbortSignal.timeout(WEB_FETCH_TIMEOUT_MS),
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location")
      if (!location) throw new Error("Die Webseite konnte nicht weitergeleitet werden.")
      if (redirects === MAX_WEB_REDIRECTS) throw new Error("Die Webseite leitet zu oft weiter.")
      target = await validateResolvedAddress(new URL(location, target).toString(), resolveHost)
      continue
    }
    if (!response.ok) throw new Error("Die Webseite ist nicht öffentlich lesbar.")
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("Die Zieladresse liefert keine lesbare Webseite.")
    }
    const body = await readBoundedResponse(response, maxBytes)
    const text = extractReadableHtml(new TextDecoder().decode(body))
    if (!text) throw new Error("Die Webseite enthält keinen lesbaren Text.")
    const document = load(new TextDecoder().decode(body))
    return {
      byteSize: body.byteLength,
      canonicalUrl: target,
      text,
      title:
        document("title").first().text().replaceAll(/\s+/g, " ").trim() || new URL(target).hostname,
    }
  }
  throw new Error("Die Webseite konnte nicht abgerufen werden.")
}
