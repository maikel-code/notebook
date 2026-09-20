import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { type RequestContext, requireOwnedNotebook } from "@/lib/auth/ownership"
import { providerError, unauthorizedError, validationError } from "@/lib/http/errors"
import { MAX_WEB_SEARCH_QUERY_CHARS, MAX_WEB_SEARCH_RESULTS } from "@/lib/limits"
import { normalizePublicUrl } from "@/lib/web/fetch"

const searchResultSchema = z.object({
  description: z.string().trim().max(1_000),
  domain: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(500),
  url: z.string().url(),
})

const searchInputSchema = z.object({
  notebookId: z.string().uuid(),
  query: z.string().trim().min(1).max(MAX_WEB_SEARCH_QUERY_CHARS),
})

export type WebSearchResult = z.infer<typeof searchResultSchema>
export type WebSearchAdapter = (query: string) => Promise<WebSearchResult[]>

export function normalizeSearchResults(results: unknown[]): WebSearchResult[] {
  const distinct = new Set<string>()
  const normalized: WebSearchResult[] = []
  for (const result of results) {
    const parsed = searchResultSchema.safeParse(result)
    if (!parsed.success) continue
    try {
      const url = normalizePublicUrl(parsed.data.url)
      if (distinct.has(url)) continue
      distinct.add(url)
      normalized.push({
        ...parsed.data,
        domain: new URL(url).hostname,
        url,
      })
    } catch {
      // Provider results are untrusted data; unsuitable targets are omitted.
    }
    if (normalized.length === MAX_WEB_SEARCH_RESULTS) break
  }
  return normalized
}

function outputText(payload: Record<string, unknown>): string {
  return typeof payload.output_text === "string" ? payload.output_text : ""
}

function citationsFromResponse(payload: Record<string, unknown>): WebSearchResult[] {
  const candidates: unknown[] = []
  const output = Array.isArray(payload.output) ? payload.output : []
  for (const item of output) {
    if (!item || typeof item !== "object") continue
    const content = Array.isArray((item as { content?: unknown }).content)
      ? ((item as { content: unknown[] }).content ?? [])
      : []
    for (const part of content) {
      if (!part || typeof part !== "object") continue
      const annotations = Array.isArray((part as { annotations?: unknown }).annotations)
        ? ((part as { annotations: unknown[] }).annotations ?? [])
        : []
      for (const annotation of annotations) {
        if (!annotation || typeof annotation !== "object") continue
        const value = annotation as { title?: unknown; url?: unknown; url_citation?: unknown }
        const citation =
          value.url_citation && typeof value.url_citation === "object"
            ? (value.url_citation as { title?: unknown; url?: unknown })
            : value
        if (typeof citation.url !== "string") continue
        candidates.push({
          description: outputText(payload).slice(0, 1_000) || "Öffentliche Webquelle",
          domain: new URL(citation.url).hostname,
          title:
            typeof citation.title === "string" ? citation.title : new URL(citation.url).hostname,
          url: citation.url,
        })
      }
    }
  }
  return normalizeSearchResults(candidates)
}

function localE2ESearchEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NOTEBOOK_E2E_INGESTION_MODE === "1" &&
    ["127.0.0.1", "localhost"].includes(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid").hostname,
    )
  )
}

export async function searchPublicWebSources(query: string): Promise<WebSearchResult[]> {
  if (localE2ESearchEnabled()) {
    return [
      {
        description: "Eine kontrollierte öffentliche Beispielseite für den Browsertest.",
        domain: "example.org",
        title: "Öffentliche Beispielquelle",
        url: "https://example.org/source",
      },
      {
        description: "Ein zweites kontrolliertes Ergebnis, das beim Import scheitert.",
        domain: "example.org",
        title: "Nicht lesbare Beispielquelle",
        url: "https://example.org/unreadable",
      },
    ]
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: `Finde höchstens ${MAX_WEB_SEARCH_RESULTS} öffentliche, frei lesbare Webseiten zu: ${query}`,
      model: "gpt-4.1-mini",
      tools: [{ type: "web_search_preview" }],
    }),
    headers: {
      authorization: `Bearer ${(await import("@/lib/env")).getServerEnvironment().OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw providerError()
  return citationsFromResponse((await response.json()) as Record<string, unknown>)
}

export async function searchWebSourcesForContext(
  context: RequestContext | null,
  input: { notebookId: string; query: string },
  service: SupabaseClient,
  adapter: WebSearchAdapter = searchPublicWebSources,
): Promise<WebSearchResult[]> {
  if (!context) throw unauthorizedError()
  const parsed = searchInputSchema.safeParse(input)
  if (!parsed.success)
    throw validationError("Der Suchbegriff muss zwischen 1 und 200 Zeichen lang sein.")
  await requireOwnedNotebook(context, parsed.data.notebookId, service)
  try {
    return normalizeSearchResults(await adapter(parsed.data.query))
  } catch (error) {
    if (error instanceof Error && "status" in error) throw error
    throw providerError()
  }
}
