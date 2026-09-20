import type { SupabaseClient } from "@supabase/supabase-js"

import { type RequestContext, requireOwnedNotebook } from "@/lib/auth/ownership"
import { notFoundError, unauthorizedError } from "@/lib/http/errors"
import type { NotebookRecord } from "@/lib/notebooks/service"

export interface WorkspaceSource {
  byteSize: number
  canonicalUrl: string | null
  createdAt: string
  errorReason: string | null
  fileName: string
  id: string
  isSelected: boolean
  notebookId: string
  originUrl: string | null
  pageCount: number | null
  sourceKind: "pdf" | "web"
  status: string
}

export interface WorkspaceOrientation {
  content: string
  createdAt: string
  id: string
  sourceId: string
  suggestedQuestions: string[]
}

export interface WorkspaceNotePreview {
  createdAt: string
  id: string
  messageId: string
  title: string
}

export interface WorkspaceSnapshot {
  notebook: NotebookRecord
  notes: WorkspaceNotePreview[]
  orientations: WorkspaceOrientation[]
  sources: WorkspaceSource[]
}

export interface SourceTextSection {
  content: string
  pageEnd: number
  pageStart: number
}

export interface WorkspaceSourceDetail extends WorkspaceSource {
  absentTextReason: string | null
  overview: string | null
  source: WorkspaceSource
  textSections: SourceTextSection[]
}

interface SourceRow {
  byte_size: number
  canonical_url: string | null
  created_at: string
  error_reason: string | null
  file_name: string
  id: string
  is_selected: boolean
  notebook_id: string
  origin_url: string | null
  page_count: number | null
  source_kind: "pdf" | "web"
  status: string
}

interface OrientationRow {
  content: string
  created_at: string
  id: string
  orientation_source_id: string
  suggested_questions: unknown
}

interface StudioNotePreviewRow {
  created_at: string
  id: string
  message_id: string
  title: string
}

interface SourceChunkRow {
  content: string
  ordinal: number
  page_end: number
  page_start: number
}

export function assembleSourceText(
  chunks: Array<{ content: string; ordinal: number; pageEnd: number; pageStart: number }>,
): SourceTextSection[] {
  const sections = new Map<string, SourceTextSection>()
  for (const chunk of [...chunks].sort((left, right) => left.ordinal - right.ordinal)) {
    const key = `${chunk.pageStart}:${chunk.pageEnd}`
    const section = sections.get(key)
    if (section) {
      section.content = `${section.content}\n\n${chunk.content}`
    } else {
      sections.set(key, {
        content: chunk.content,
        pageEnd: chunk.pageEnd,
        pageStart: chunk.pageStart,
      })
    }
  }
  return [...sections.values()].sort(
    (left, right) => left.pageStart - right.pageStart || left.pageEnd - right.pageEnd,
  )
}

export function createSourceOverview(
  source: Pick<WorkspaceSource, "byteSize" | "fileName" | "pageCount" | "sourceKind">,
  preview: string,
): string | null {
  const normalizedPreview = preview.replaceAll(/\s+/g, " ").trim()
  if (!normalizedPreview) return null
  const size = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(
    source.byteSize / 1024,
  )
  const scope = source.pageCount ? `${source.pageCount} Seiten` : "ohne Seitenangabe"
  const textPreview = normalizedPreview.slice(0, 500)
  const ellipsis = normalizedPreview.length > textPreview.length ? "…" : ""
  return `${source.sourceKind === "pdf" ? "PDF" : "Webquelle"} · ${scope} · ${size} KB. Textvorschau: ${textPreview}${ellipsis}`
}

function requireContext(context: RequestContext | null): RequestContext {
  if (!context) throw unauthorizedError()
  return context
}

function toSource(row: SourceRow): WorkspaceSource {
  return {
    byteSize: row.byte_size,
    canonicalUrl: row.canonical_url,
    createdAt: row.created_at,
    errorReason: row.error_reason,
    fileName: row.file_name,
    id: row.id,
    isSelected: row.is_selected,
    notebookId: row.notebook_id,
    originUrl: row.origin_url,
    pageCount: row.page_count,
    sourceKind: row.source_kind,
    status: row.status,
  }
}

function toOrientation(row: OrientationRow): WorkspaceOrientation {
  return {
    content: row.content,
    createdAt: row.created_at,
    id: row.id,
    sourceId: row.orientation_source_id,
    suggestedQuestions: Array.isArray(row.suggested_questions)
      ? row.suggested_questions.filter(
          (question): question is string => typeof question === "string",
        )
      : [],
  }
}

function toNotePreview(row: StudioNotePreviewRow): WorkspaceNotePreview {
  return {
    createdAt: row.created_at,
    id: row.id,
    messageId: row.message_id,
    title: row.title,
  }
}

export async function getSourceDetailForContext(
  context: RequestContext | null,
  notebookId: string,
  sourceId: string,
  service: SupabaseClient,
): Promise<WorkspaceSourceDetail> {
  const { userId } = requireContext(context)
  await requireOwnedNotebook({ userId }, notebookId, service)

  const { data, error } = await service
    .from("sources")
    .select(
      "id, notebook_id, file_name, source_kind, origin_url, canonical_url, byte_size, page_count, status, error_reason, is_selected, created_at",
    )
    .eq("id", sourceId)
    .eq("notebook_id", notebookId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error || !data) throw notFoundError()
  const source = toSource(data as SourceRow)
  const { data: chunkRows, error: chunkError } = await service
    .from("chunks")
    .select("ordinal, page_start, page_end, content")
    .eq("source_id", sourceId)
    .eq("user_id", userId)
    .order("ordinal", { ascending: true })
  if (chunkError) throw new Error("Quellentext konnte nicht geladen werden.")

  const textSections = assembleSourceText(
    ((chunkRows ?? []) as SourceChunkRow[]).map((chunk) => ({
      content: chunk.content,
      ordinal: chunk.ordinal,
      pageEnd: chunk.page_end,
      pageStart: chunk.page_start,
    })),
  )
  const overview = createSourceOverview(
    source,
    textSections.map((section) => section.content).join("\n"),
  )
  const absentTextReason = textSections.length
    ? null
    : source.errorReason ||
      (source.status === "ready"
        ? "Für diese Quelle wurde kein lesbarer Text gespeichert."
        : "Der Quellentext ist erst nach erfolgreicher Verarbeitung verfügbar.")

  return { ...source, absentTextReason, overview, source, textSections }
}

export async function getWorkspaceSnapshotForContext(
  context: RequestContext | null,
  notebookId: string,
  service: SupabaseClient,
): Promise<WorkspaceSnapshot> {
  const { userId } = requireContext(context)
  const notebook = (await requireOwnedNotebook({ userId }, notebookId, service)) as NotebookRecord
  const [sources, orientations, notes] = await Promise.all([
    service
      .from("sources")
      .select(
        "id, notebook_id, file_name, source_kind, origin_url, canonical_url, byte_size, page_count, status, error_reason, is_selected, created_at",
      )
      .eq("notebook_id", notebookId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    service
      .from("messages")
      .select("id, content, orientation_source_id, suggested_questions, created_at")
      .eq("notebook_id", notebookId)
      .eq("user_id", userId)
      .eq("message_kind", "source_orientation")
      .order("created_at", { ascending: true }),
    service
      .from("studio_notes")
      .select("id, message_id, title, created_at")
      .eq("notebook_id", notebookId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ])
  if (sources.error || orientations.error || notes.error) {
    throw new Error("Der Arbeitsbereich konnte nicht geladen werden.")
  }

  return {
    notebook,
    notes: ((notes.data ?? []) as StudioNotePreviewRow[]).map(toNotePreview),
    orientations: ((orientations.data ?? []) as OrientationRow[]).map(toOrientation),
    sources: ((sources.data ?? []) as SourceRow[]).map(toSource),
  }
}
