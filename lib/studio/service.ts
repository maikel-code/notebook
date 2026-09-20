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
  contentSnapshot: string
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

function toNote(row: NoteRow): StudioNote {
  return { ...toPreview(row), contentSnapshot: row.content_snapshot }
}

function titleForQuestion(question: string): string {
  const normalized = question.trim().replaceAll(/\s+/g, " ")
  return normalized.length <= 200 ? normalized : `${normalized.slice(0, 199).trimEnd()}…`
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
      title: titleForQuestion(question.content),
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
  return toNote(data as NoteRow)
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
  return toNote(data as NoteRow)
}
