import type { SupabaseClient } from "@supabase/supabase-js"

import { type RequestContext, requireOwnedNotebook } from "@/lib/auth/ownership"
import { notFoundError, unauthorizedError, validationError } from "@/lib/http/errors"

export interface StudioNotePreview {
  createdAt: string
  id: string
  messageId: string
  notebookId: string
  title: string
}

export interface StudioNote extends StudioNotePreview {
  citations: StudioNoteCitation[]
  contentSnapshot: string
}

export interface StudioNoteCitation {
  id: string
  originUrl: string | null
  pageStart: number
  quote: string
  sourceId: string | null
  sourceKind: "pdf" | "web" | null
  sourceName: string
}

export interface SaveStudioNoteInput {
  messageId: string
  notebookId: string
}

interface AnswerRow {
  content: string
  id: string
  message_kind: "answer" | "source_orientation"
  notebook_id: string
  question_message_id: string | null
  role: string
  status: string
  unsupported_reason: string | null
}

interface QuestionRow {
  content: string
  id: string
  role: string
}

interface NoteRow {
  content_snapshot: string
  created_at: string
  id: string
  message_id: string
  notebook_id: string
  title: string
}

interface CitationRow {
  id: string
  page_start: number
  quote: string
  source_id: string | null
  source_name: string
  sources:
    | { origin_url: string | null; source_kind: "pdf" | "web" }
    | Array<{ origin_url: string | null; source_kind: "pdf" | "web" }>
    | null
}

function requireContext(context: RequestContext | null): RequestContext {
  if (!context) throw unauthorizedError()
  return context
}

function toPreview(row: NoteRow): StudioNotePreview {
  return {
    createdAt: row.created_at,
    id: row.id,
    messageId: row.message_id,
    notebookId: row.notebook_id,
    title: row.title,
  }
}

function toNote(row: NoteRow, citations: StudioNoteCitation[]): StudioNote {
  return { ...toPreview(row), citations, contentSnapshot: row.content_snapshot }
}

export function createStudioNoteTitle(question: string): string {
  const normalized = question.trim().replaceAll(/\s+/g, " ")
  return normalized.length <= 200 ? normalized : `${normalized.slice(0, 199).trimEnd()}…`
}

export function isSaveableStudioAnswer(answer: {
  citations: Array<{ id: string }>
  messageKind: string
  role: string
  status: string
  unsupportedReason: string | null
}): boolean {
  return (
    answer.role === "assistant" &&
    answer.messageKind === "answer" &&
    answer.status === "complete" &&
    answer.unsupportedReason === null &&
    answer.citations.length > 0
  )
}

export async function saveStudioNoteForContext(
  context: RequestContext | null,
  input: SaveStudioNoteInput,
  service: SupabaseClient,
): Promise<StudioNote> {
  const { userId } = requireContext(context)
  await requireOwnedNotebook({ userId }, input.notebookId, service)

  const { data: answerData, error: answerError } = await service
    .from("messages")
    .select(
      "id, notebook_id, role, status, unsupported_reason, content, question_message_id, message_kind",
    )
    .eq("id", input.messageId)
    .eq("notebook_id", input.notebookId)
    .eq("user_id", userId)
    .maybeSingle()
  const answer = answerData as AnswerRow | null
  if (answerError || !answer) throw notFoundError()
  if (
    answer.role !== "assistant" ||
    answer.message_kind !== "answer" ||
    answer.status !== "complete" ||
    answer.unsupported_reason !== null ||
    !answer.question_message_id
  ) {
    throw validationError("Nur vollständig belegte Antworten können als Notiz gespeichert werden.")
  }

  const { data: citation, error: citationError } = await service
    .from("citations")
    .select("id")
    .eq("message_id", answer.id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()
  if (citationError) throw new Error("Die Belege der Antwort konnten nicht geprüft werden.")
  if (!citation) {
    throw validationError("Nur vollständig belegte Antworten können als Notiz gespeichert werden.")
  }

  const { data: questionData, error: questionError } = await service
    .from("messages")
    .select("id, role, content")
    .eq("id", answer.question_message_id)
    .eq("notebook_id", input.notebookId)
    .eq("user_id", userId)
    .maybeSingle()
  const question = questionData as QuestionRow | null
  if (questionError || !question || question.role !== "user") throw notFoundError()

  const { error: insertError } = await service.from("studio_notes").upsert(
    {
      content_snapshot: answer.content,
      message_id: answer.id,
      notebook_id: input.notebookId,
      title: createStudioNoteTitle(question.content),
      user_id: userId,
    },
    { ignoreDuplicates: true, onConflict: "message_id" },
  )
  if (insertError) throw new Error("Die Notiz konnte nicht gespeichert werden.")

  return getStudioNoteByMessageForContext({ userId }, input.notebookId, answer.id, service)
}

export async function listStudioNotesForContext(
  context: RequestContext | null,
  notebookId: string,
  service: SupabaseClient,
): Promise<StudioNotePreview[]> {
  const { userId } = requireContext(context)
  await requireOwnedNotebook({ userId }, notebookId, service)
  const { data, error } = await service
    .from("studio_notes")
    .select("id, notebook_id, message_id, title, created_at, content_snapshot")
    .eq("notebook_id", notebookId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) throw new Error("Die Studio-Notizen konnten nicht geladen werden.")
  return ((data ?? []) as NoteRow[]).map(toPreview)
}

export async function getStudioNoteForContext(
  context: RequestContext | null,
  notebookId: string,
  noteId: string,
  service: SupabaseClient,
): Promise<StudioNote> {
  const { userId } = requireContext(context)
  await requireOwnedNotebook({ userId }, notebookId, service)
  const { data, error } = await service
    .from("studio_notes")
    .select("id, notebook_id, message_id, title, content_snapshot, created_at")
    .eq("id", noteId)
    .eq("notebook_id", notebookId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error || !data) throw notFoundError()
  const note = data as NoteRow
  return toNote(note, await listStudioNoteCitations(note.message_id, userId, service))
}

async function getStudioNoteByMessageForContext(
  context: RequestContext,
  notebookId: string,
  messageId: string,
  service: SupabaseClient,
): Promise<StudioNote> {
  const { data, error } = await service
    .from("studio_notes")
    .select("id, notebook_id, message_id, title, content_snapshot, created_at")
    .eq("message_id", messageId)
    .eq("notebook_id", notebookId)
    .eq("user_id", context.userId)
    .maybeSingle()
  if (error || !data) throw new Error("Die gespeicherte Notiz konnte nicht geladen werden.")
  return toNote(data as NoteRow, await listStudioNoteCitations(messageId, context.userId, service))
}

async function listStudioNoteCitations(
  messageId: string,
  userId: string,
  service: SupabaseClient,
): Promise<StudioNoteCitation[]> {
  const { data, error } = await service
    .from("citations")
    .select("id, source_id, source_name, quote, page_start, sources(source_kind, origin_url)")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .order("ordinal", { ascending: true })
  if (error) throw new Error("Die Notizbelege konnten nicht geladen werden.")
  return ((data ?? []) as unknown as CitationRow[]).map((citation) => {
    const source = Array.isArray(citation.sources) ? citation.sources[0] : citation.sources
    return {
      id: citation.id,
      originUrl: source?.origin_url ?? null,
      pageStart: citation.page_start,
      quote: citation.quote,
      sourceId: citation.source_id,
      sourceKind: source?.source_kind ?? null,
      sourceName: citation.source_name,
    }
  })
}
