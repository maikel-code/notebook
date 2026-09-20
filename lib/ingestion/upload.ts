import { randomUUID } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { RequestContext } from "@/lib/auth/ownership"
import { conflictError, notFoundError, unauthorizedError, validationError } from "@/lib/http/errors"
import { SOURCES_BUCKET } from "@/lib/ingestion/storage"
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

  const intent = parseUploadIntent(input.intent)
  const sourceId = randomUUID()
  const { data, error } = await service.rpc("prepare_source_upload", {
    p_byte_size: input.byteSize,
    p_content_hash: input.contentHash,
    p_file_name: input.fileName.trim(),
    p_intent: input.intent ? intent : null,
    p_max_sources: MAX_SOURCES_PER_NOTEBOOK,
    p_notebook_id: input.notebookId,
    p_replace_source_id: input.replaceSourceId ?? null,
    p_source_id: sourceId,
    p_user_id: userId,
  })
  if (error) {
    if (/notebook not found|replacement source not found/.test(error.message)) throw notFoundError()
    throw new Error("Upload konnte nicht vorbereitet werden.")
  }
  const result = data?.[0] as
    | {
        decision: "duplicate" | "ok" | "rejected"
        existing_source_id: string | null
        reason: string | null
        source_id: string | null
        storage_path: string | null
      }
    | undefined
  if (!result) throw new Error("Upload konnte nicht vorbereitet werden.")
  if (result.decision === "duplicate" && result.existing_source_id) {
    return { decision: "duplicate", existingSourceId: result.existing_source_id }
  }
  if (result.decision === "rejected" && result.reason) {
    return { decision: "rejected", reason: result.reason }
  }
  if (result.decision === "ok" && result.source_id && result.storage_path) {
    return { decision: "ok", sourceId: result.source_id, storagePath: result.storage_path }
  }
  throw new Error("Upload konnte nicht vorbereitet werden.")
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
  if (confirmError) {
    if (confirmError.code === "P0001") {
      throw conflictError("Die laufende Antwort muss zuerst beendet oder abgebrochen werden.")
    }
    throw new Error("Upload konnte nicht bestätigt werden.")
  }
}

export async function cancelUploadForContext(
  context: RequestContext | null,
  sourceId: string,
  service: SupabaseClient,
): Promise<void> {
  const { userId } = requireContext(context)
  const { data: storagePath, error } = await service.rpc("cancel_source_upload", {
    p_source_id: sourceId,
    p_user_id: userId,
  })
  if (error) {
    if (/source not found/.test(error.message)) throw notFoundError()
    if (/upload draft/.test(error.message))
      throw validationError("Dieser Upload kann nicht abgebrochen werden.")
    throw new Error("Upload konnte nicht abgebrochen werden.")
  }
  if (typeof storagePath !== "string") throw new Error("Upload konnte nicht abgebrochen werden.")
  const { error: storageError } = await service.storage.from(SOURCES_BUCKET).remove([storagePath])
  if (storageError) throw new Error("Upload konnte nicht vollständig abgebrochen werden.")
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
