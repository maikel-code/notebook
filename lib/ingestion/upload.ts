import { randomUUID } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { RequestContext } from "@/lib/auth/ownership"
import { notFoundError, unauthorizedError, validationError } from "@/lib/http/errors"
import { SOURCES_BUCKET, sourceStoragePath } from "@/lib/ingestion/storage"
import { validatePdf } from "@/lib/ingestion/validate-pdf"
import { MAX_FILE_BYTES, MAX_SOURCES_PER_NOTEBOOK } from "@/lib/limits"
import { getNotebookForContext } from "@/lib/notebooks/service"
import { sha256Hex } from "@/lib/upload/hash"

export type UploadIntent = "add" | "replace"

export interface PrepareUploadInput {
  byteSize: number
  contentHash: string
  fileName: string
  intent?: string
  notebookId: string
  replaceSourceId?: string
}

export type PrepareUploadResult =
  | { decision: "duplicate"; existingSourceId: string }
  | { decision: "rejected"; reason: string }
  | { decision: "ok"; sourceId: string; storagePath: string }

interface OwnedSource {
  byte_size: number
  content_hash: string
  id: string
  notebook_id: string
  status: string
  storage_path: string
  user_id: string
}

function requireContext(context: RequestContext | null): RequestContext {
  if (!context) throw unauthorizedError()
  return context
}

export function parseUploadIntent(intent: string | undefined): UploadIntent {
  if (!intent || intent === "add") return "add"
  if (intent === "replace") return "replace"
  throw validationError("Die Upload-Entscheidung ist ungültig.")
}

function validatePrepareInput(input: PrepareUploadInput): void {
  if (!input.fileName.trim()) throw validationError("Die Datei benötigt einen Namen.")
  if (!/^[0-9a-f]{64}$/.test(input.contentHash)) {
    throw validationError("Die Dateiprüfsumme ist ungültig.")
  }
  if (!Number.isInteger(input.byteSize) || input.byteSize < 1) {
    throw validationError("Die Dateigröße ist ungültig.")
  }
}

async function ownedSource(
  service: SupabaseClient,
  sourceId: string,
  userId: string,
): Promise<OwnedSource> {
  const { data, error } = await service
    .from("sources")
    .select("id, user_id, notebook_id, content_hash, byte_size, storage_path, status")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error || !data) throw notFoundError()
  return data as OwnedSource
}

export async function prepareUploadForContext(
  context: RequestContext | null,
  input: PrepareUploadInput,
  service: SupabaseClient,
): Promise<PrepareUploadResult> {
  const { userId } = requireContext(context)
  validatePrepareInput(input)
  await getNotebookForContext({ userId }, input.notebookId, service)
  if (input.byteSize > MAX_FILE_BYTES) {
    return { decision: "rejected", reason: "Die PDF-Datei darf höchstens 10 MB groß sein." }
  }

  const { data: sources, error } = await service
    .from("sources")
    .select("id, content_hash, replaces_source_id")
    .eq("notebook_id", input.notebookId)
    .eq("user_id", userId)
  if (error) throw new Error("Quellen konnten nicht geprüft werden.")
  const allSources = sources ?? []
  const duplicate = allSources.find((source) => source.content_hash === input.contentHash)
  if (duplicate && !input.intent) return { decision: "duplicate", existingSourceId: duplicate.id }

  const intent = parseUploadIntent(input.intent)
  const activeSourceCount = allSources.filter((source) => !source.replaces_source_id).length
  let replacesSourceId: string | null = null
  if (intent === "replace") {
    if (!input.replaceSourceId || input.replaceSourceId !== duplicate?.id) throw notFoundError()
    replacesSourceId = duplicate.id
  } else if (activeSourceCount >= MAX_SOURCES_PER_NOTEBOOK) {
    return { decision: "rejected", reason: "Ein Notebook darf höchstens 30 Quellen enthalten." }
  }

  const sourceId = randomUUID()
  const storagePath = sourceStoragePath(userId, input.notebookId, sourceId)
  const { error: insertError } = await service.from("sources").insert({
    byte_size: input.byteSize,
    content_hash: input.contentHash,
    file_name: input.fileName.trim(),
    id: sourceId,
    notebook_id: input.notebookId,
    replaces_source_id: replacesSourceId,
    storage_path: storagePath,
    status: "uploading",
    user_id: userId,
  })
  if (insertError) throw new Error("Upload konnte nicht vorbereitet werden.")
  return { decision: "ok", sourceId, storagePath }
}

export async function verifyUploadedObject(
  source: Pick<OwnedSource, "byte_size" | "content_hash">,
  file: Uint8Array | null,
): Promise<void> {
  if (!file || file.byteLength !== source.byte_size) {
    throw validationError("Die hochgeladene Datei konnte nicht bestätigt werden.")
  }
  if ((await sha256Hex(file)) !== source.content_hash) {
    throw validationError("Die hochgeladene Datei konnte nicht bestätigt werden.")
  }
}

export async function confirmUploadForContext(
  context: RequestContext | null,
  sourceId: string,
  service: SupabaseClient,
): Promise<void> {
  const { userId } = requireContext(context)
  const source = await ownedSource(service, sourceId, userId)
  if (source.status === "processing") return
  if (source.status !== "uploading")
    throw validationError("Dieser Upload kann nicht bestätigt werden.")
  const { data, error } = await service.storage.from(SOURCES_BUCKET).download(source.storage_path)
  if (error || !data) throw validationError("Die hochgeladene Datei konnte nicht bestätigt werden.")
  const file = new Uint8Array(await data.arrayBuffer())
  await verifyUploadedObject(source, file)
  const validated = await validatePdf(file, "source.pdf")
  const { error: pageCountError } = await service
    .from("sources")
    .update({ page_count: validated.pageCount })
    .eq("id", sourceId)
    .eq("user_id", userId)
  if (pageCountError) throw new Error("Die PDF-Datei konnte nicht bestätigt werden.")
  const { error: confirmError } = await service.rpc("confirm_source_upload", {
    p_source_id: sourceId,
    p_user_id: userId,
  })
  if (confirmError) throw new Error("Upload konnte nicht bestätigt werden.")
}

export async function cancelUploadForContext(
  context: RequestContext | null,
  sourceId: string,
  service: SupabaseClient,
): Promise<void> {
  const { userId } = requireContext(context)
  const source = await ownedSource(service, sourceId, userId)
  if (source.status !== "uploading")
    throw validationError("Dieser Upload kann nicht abgebrochen werden.")
  await service.from("sources").delete().eq("id", source.id).eq("user_id", userId)
  await service.storage.from(SOURCES_BUCKET).remove([source.storage_path])
}

export async function retryIngestionForContext(
  context: RequestContext | null,
  sourceId: string,
  service: SupabaseClient,
): Promise<void> {
  const { userId } = requireContext(context)
  const source = await ownedSource(service, sourceId, userId)
  if (source.status !== "failed")
    throw validationError("Nur fehlgeschlagene Quellen können erneut verarbeitet werden.")
  const { error } = await service.rpc("retry_source_ingestion", {
    p_source_id: sourceId,
    p_user_id: userId,
  })
  if (error) throw new Error("Die Verarbeitung konnte nicht erneut gestartet werden.")
}
