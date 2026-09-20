import "server-only"

import { randomUUID } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { type RequestContext, requireOwnedNotebook } from "@/lib/auth/ownership"
import { unauthorizedError, validationError } from "@/lib/http/errors"
import { MAX_SELECTED_SOURCES, MAX_SOURCES_PER_NOTEBOOK } from "@/lib/limits"
import { sha256Hex } from "@/lib/upload/hash"
import { normalizePublicUrl } from "@/lib/web/fetch"

const importInputSchema = z.object({
  notebookId: z.string().uuid(),
  urls: z.array(z.string().url()).min(1).max(MAX_SELECTED_SOURCES),
})

export interface WebImportOutcome {
  reason?: string
  sourceId?: string
  status: "already_present" | "failed" | "rejected" | "started"
  url: string
}

export interface WebImportResult {
  outcomes: WebImportOutcome[]
}

function sourceName(url: string): string {
  return new URL(url).hostname
}

async function sourceLimitReached(
  service: SupabaseClient,
  notebookId: string,
  userId: string,
): Promise<boolean> {
  const { count, error } = await service
    .from("sources")
    .select("id", { count: "exact", head: true })
    .eq("notebook_id", notebookId)
    .eq("user_id", userId)
  if (error) throw new Error("Quellenbestand konnte nicht geprüft werden.")
  return (count ?? 0) >= MAX_SOURCES_PER_NOTEBOOK
}

async function hasCanonicalSource(
  service: SupabaseClient,
  notebookId: string,
  userId: string,
  canonicalUrl: string,
): Promise<boolean> {
  const { data, error } = await service
    .from("sources")
    .select("id")
    .eq("notebook_id", notebookId)
    .eq("user_id", userId)
    .eq("source_kind", "web")
    .eq("canonical_url", canonicalUrl)
    .maybeSingle()
  if (error) throw new Error("Webquelle konnte nicht geprüft werden.")
  return Boolean(data)
}

export async function importWebSourcesForContext(
  context: RequestContext | null,
  input: { notebookId: string; urls: string[] },
  service: SupabaseClient,
): Promise<WebImportResult> {
  if (!context) throw unauthorizedError()
  const parsed = importInputSchema.safeParse(input)
  if (!parsed.success) {
    throw validationError("Wähle zwischen einer und zehn öffentlichen Webseiten aus.")
  }
  const { notebookId, urls } = parsed.data
  await requireOwnedNotebook(context, notebookId, service)
  const outcomes: WebImportOutcome[] = []
  const prepared = new Set<string>()

  for (const submittedUrl of urls) {
    let canonicalUrl: string
    try {
      canonicalUrl = normalizePublicUrl(submittedUrl)
    } catch {
      outcomes.push({
        reason: "Die Zieladresse ist keine öffentliche HTTPS-Webseite.",
        status: "rejected",
        url: submittedUrl,
      })
      continue
    }
    if (
      prepared.has(canonicalUrl) ||
      (await hasCanonicalSource(service, notebookId, context.userId, canonicalUrl))
    ) {
      outcomes.push({
        reason: "Diese Webquelle ist bereits im Notebook vorhanden.",
        status: "already_present",
        url: submittedUrl,
      })
      continue
    }
    if (await sourceLimitReached(service, notebookId, context.userId)) {
      outcomes.push({
        reason: "Ein Notebook darf höchstens 30 Quellen enthalten.",
        status: "rejected",
        url: submittedUrl,
      })
      continue
    }

    const sourceId = randomUUID()
    const { error: sourceError } = await service.from("sources").insert({
      byte_size: 1,
      canonical_url: canonicalUrl,
      content_hash: await sha256Hex(new TextEncoder().encode(canonicalUrl)),
      file_name: sourceName(canonicalUrl),
      id: sourceId,
      notebook_id: notebookId,
      origin_url: canonicalUrl,
      page_count: 1,
      source_kind: "web",
      status: "processing",
      storage_path: null,
      user_id: context.userId,
    })
    if (sourceError) {
      if (sourceError.code === "23505") {
        outcomes.push({
          reason: "Diese Webquelle ist bereits im Notebook vorhanden.",
          status: "already_present",
          url: submittedUrl,
        })
        continue
      }
      outcomes.push({
        reason: "Die Webquelle konnte nicht vorbereitet werden.",
        status: "failed",
        url: submittedUrl,
      })
      continue
    }
    const { error: jobError } = await service.from("ingestion_jobs").insert({
      source_id: sourceId,
      status: "queued",
      user_id: context.userId,
    })
    if (jobError) {
      await service.from("sources").delete().eq("id", sourceId).eq("user_id", context.userId)
      outcomes.push({
        reason: "Die Webquelle konnte nicht zur Verarbeitung vorgemerkt werden.",
        status: "failed",
        url: submittedUrl,
      })
      continue
    }
    prepared.add(canonicalUrl)
    outcomes.push({ sourceId, status: "started", url: submittedUrl })
  }
  return { outcomes }
}
