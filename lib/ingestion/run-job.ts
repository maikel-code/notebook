import type { SupabaseClient } from "@supabase/supabase-js"

import { writeDiagnostic } from "@/lib/diagnostics"
import { chunkExtractedPages } from "@/lib/ingestion/chunk"
import { cleanupStoragePath } from "@/lib/ingestion/cleanup"
import { embedChunks } from "@/lib/ingestion/embed"
import { extractPdfText } from "@/lib/ingestion/extract"
import { LocalE2EIngestionFailure } from "@/lib/ingestion/local-e2e"
import { replaceChunksForSource } from "@/lib/ingestion/persist"
import { nextRetryState } from "@/lib/ingestion/retry"
import { SOURCES_BUCKET } from "@/lib/ingestion/storage"
import { validatePdf } from "@/lib/ingestion/validate-pdf"
import { MAX_JOB_ATTEMPTS } from "@/lib/limits"

interface ClaimedJob {
  attempt: number
  correlation_id: string
  id: string
  source_id: string
  user_id: string
}

interface JobSource {
  cleanup_storage_path: string | null
  id: string
  storage_path: string
  user_id: string
}

export async function loadOwnedJobSource(
  service: SupabaseClient,
  sourceId: string,
  userId: string,
): Promise<JobSource> {
  const { data: source, error } = await service
    .from("sources")
    .select("id, user_id, storage_path, cleanup_storage_path")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error || !source) throw new Error("Auftragsquelle fehlt.")
  return source as JobSource
}

async function updatePhase(
  service: SupabaseClient,
  job: ClaimedJob,
  phase: "cleanup" | "extract" | "chunk" | "embed" | "finalize",
): Promise<void> {
  const { error } = await service
    .from("ingestion_jobs")
    .update({ phase })
    .eq("id", job.id)
    .eq("user_id", job.user_id)
  if (error) throw new Error("Auftragsphase konnte nicht aktualisiert werden.")
}

async function failJob(
  service: SupabaseClient,
  job: ClaimedJob,
  phase: string,
  forceTerminalFailure = false,
): Promise<void> {
  const retry = forceTerminalFailure
    ? { attempt: MAX_JOB_ATTEMPTS, status: "failed" as const }
    : nextRetryState(job.attempt)
  const { error } = await service
    .from("ingestion_jobs")
    .update({
      attempt: retry.attempt,
      finished_at: retry.status === "failed" ? new Date().toISOString() : null,
      last_error: "Die PDF-Verarbeitung ist fehlgeschlagen.",
      locked_at: null,
      status: retry.status,
    })
    .eq("id", job.id)
    .eq("user_id", job.user_id)
  if (error) throw new Error("Fehlerzustand konnte nicht gespeichert werden.")
  if (retry.status === "failed") {
    await service
      .from("sources")
      .update({ error_reason: "Die PDF-Verarbeitung ist fehlgeschlagen.", status: "failed" })
      .eq("id", job.source_id)
      .eq("user_id", job.user_id)
  }
  writeDiagnostic({
    cause: "INGESTION_FAILED",
    correlationId: job.correlation_id,
    phase: phase as never,
  })
}

export async function runNextIngestionJob(
  service: SupabaseClient,
  sourceId?: string,
): Promise<boolean> {
  const { data, error } = await service.rpc("claim_next_ingestion_job", {
    p_source_id: sourceId ?? null,
  })
  if (error) throw new Error("Auftrag konnte nicht beansprucht werden.")
  const job = (data?.[0] ?? null) as ClaimedJob | null
  if (!job) return false

  let phase = "extract"
  try {
    const ownedSource = await loadOwnedJobSource(service, job.source_id, job.user_id)

    phase = "cleanup"
    await updatePhase(service, job, "cleanup")
    await cleanupStoragePath(service, ownedSource.id, job.user_id, ownedSource.cleanup_storage_path)

    phase = "extract"
    await updatePhase(service, job, "extract")
    const { data: file, error: fileError } = await service.storage
      .from(SOURCES_BUCKET)
      .download(ownedSource.storage_path)
    if (fileError || !file) throw new Error("Quellendatei fehlt.")
    const bytes = new Uint8Array(await file.arrayBuffer())
    await validatePdf(bytes, "source.pdf")
    const pages = await extractPdfText(bytes)

    phase = "chunk"
    await updatePhase(service, job, "chunk")
    const chunks = chunkExtractedPages(pages)
    if (chunks.length === 0) {
      await service
        .from("sources")
        .update({ error_reason: null, status: "unusable" })
        .eq("id", ownedSource.id)
        .eq("user_id", job.user_id)
      await service
        .from("ingestion_jobs")
        .update({ finished_at: new Date().toISOString(), locked_at: null, status: "succeeded" })
        .eq("id", job.id)
        .eq("user_id", job.user_id)
      return true
    }

    phase = "embed"
    await updatePhase(service, job, "embed")
    const embeddings = await embedChunks(chunks.map((chunk) => chunk.content))
    await replaceChunksForSource(
      service,
      ownedSource.id,
      job.user_id,
      chunks.map((chunk, index) => ({ ...chunk, embedding: embeddings[index] ?? [] })),
    )

    phase = "finalize"
    await updatePhase(service, job, "finalize")
    const now = new Date().toISOString()
    const { error: finishError } = await service
      .from("ingestion_jobs")
      .update({ finished_at: now, locked_at: null, status: "succeeded" })
      .eq("id", job.id)
      .eq("user_id", job.user_id)
    if (finishError) throw new Error("Auftrag konnte nicht abgeschlossen werden.")
    const { error: sourceFinishError } = await service
      .from("sources")
      .update({ error_reason: null, status: "ready" })
      .eq("id", ownedSource.id)
      .eq("user_id", job.user_id)
    if (sourceFinishError) throw new Error("Quelle konnte nicht abgeschlossen werden.")
    return true
  } catch (error) {
    await failJob(service, job, phase, error instanceof LocalE2EIngestionFailure)
    return true
  }
}

export async function sweepIngestionJobs(service: SupabaseClient): Promise<number> {
  const { data, error } = await service.rpc("sweep_stale_ingestion_jobs")
  if (error) throw new Error("Hängende Aufträge konnten nicht geprüft werden.")
  const swept = Number(data ?? 0)
  await runNextIngestionJob(service)
  return swept
}
