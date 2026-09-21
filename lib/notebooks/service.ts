import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { type RequestContext, requireOwnedNotebook } from "@/lib/auth/ownership"
import { conflictError, notFoundError, unauthorizedError, validationError } from "@/lib/http/errors"
import { MAX_SELECTED_SOURCES } from "@/lib/limits"

export type { RequestContext } from "@/lib/auth/ownership"

export interface NotebookRecord {
  created_at: string
  id: string
  name: string
  updated_at: string
  user_id: string
}

const notebookNameSchema = z.string().trim().min(1).max(200)

function requireContext(context: RequestContext | null): RequestContext {
  if (!context) {
    throw unauthorizedError()
  }
  return context
}

function parseNotebookName(name: string): string {
  const parsed = notebookNameSchema.safeParse(name)
  if (!parsed.success) {
    throw validationError("Der Notebook-Name muss zwischen 1 und 200 Zeichen lang sein.")
  }
  return parsed.data
}

export async function listNotebooksForContext(
  context: RequestContext | null,
  service: SupabaseClient,
): Promise<NotebookRecord[]> {
  const { userId } = requireContext(context)
  const { data, error } = await service
    .from("notebooks")
    .select("id, user_id, name, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error("Notebooks konnten nicht geladen werden.")
  return data as NotebookRecord[]
}

export async function getNotebookForContext(
  context: RequestContext | null,
  notebookId: string,
  service: SupabaseClient,
): Promise<NotebookRecord> {
  return (await requireOwnedNotebook(context, notebookId, service)) as NotebookRecord
}

export async function createNotebookForContext(
  context: RequestContext | null,
  name: string,
  service: SupabaseClient,
): Promise<string> {
  const { userId } = requireContext(context)
  const validName = parseNotebookName(name)
  const { data, error } = await service
    .from("notebooks")
    .insert({ name: validName, user_id: userId })
    .select("id")
    .single()

  if (error || !data) throw new Error("Notebook konnte nicht angelegt werden.")
  return data.id
}

export async function renameNotebookForContext(
  context: RequestContext | null,
  notebookId: string,
  name: string,
  service: SupabaseClient,
): Promise<void> {
  const authorized = requireContext(context)
  await getNotebookForContext(authorized, notebookId, service)
  const validName = parseNotebookName(name)
  const { error } = await service
    .from("notebooks")
    .update({ name: validName, updated_at: new Date().toISOString() })
    .eq("id", notebookId)
    .eq("user_id", authorized.userId)

  if (error) throw new Error("Notebook konnte nicht umbenannt werden.")
}

export async function deleteNotebookForContext(
  context: RequestContext | null,
  notebookId: string,
  confirmed: boolean,
  service: SupabaseClient,
): Promise<void> {
  const authorized = requireContext(context)
  await getNotebookForContext(authorized, notebookId, service)

  if (!confirmed) {
    throw validationError("Die Löschung muss bestätigt werden.")
  }

  const { data: streamingMessage, error: streamingError } = await service
    .from("messages")
    .select("id")
    .eq("notebook_id", notebookId)
    .eq("user_id", authorized.userId)
    .eq("role", "assistant")
    .eq("status", "streaming")
    .limit(1)
    .maybeSingle()

  if (streamingError) throw new Error("Notebook-Zustand konnte nicht geprüft werden.")
  if (streamingMessage) {
    throw conflictError("Die laufende Antwort muss zuerst beendet oder abgebrochen werden.")
  }

  const { error } = await service
    .from("notebooks")
    .delete()
    .eq("id", notebookId)
    .eq("user_id", authorized.userId)

  if (error) throw new Error("Notebook konnte nicht gelöscht werden.")
}

interface OwnedSource {
  id: string
  is_selected: boolean
  notebook_id: string
  status: string
}

export async function setSourceSelectedForContext(
  context: RequestContext | null,
  sourceId: string,
  selected: boolean,
  service: SupabaseClient,
): Promise<{ isSelected: boolean; notebookId: string }> {
  const { userId } = requireContext(context)
  const { data: source, error: sourceError } = await service
    .from("sources")
    .select("id, notebook_id, status, is_selected")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle()
  if (sourceError || !source) {
    throw notFoundError()
  }
  const ownedSource = source as OwnedSource

  if (selected && ownedSource.status !== "ready") {
    throw validationError("Nur bereite Quellen können für Fragen ausgewählt werden.")
  }

  if (selected && !ownedSource.is_selected) {
    const { count, error: countError } = await service
      .from("sources")
      .select("id", { count: "exact", head: true })
      .eq("notebook_id", ownedSource.notebook_id)
      .eq("user_id", userId)
      .eq("is_selected", true)
    if (countError) throw new Error("Quellenauswahl konnte nicht geprüft werden.")
    if ((count ?? 0) >= MAX_SELECTED_SOURCES) {
      throw validationError(`Es dürfen höchstens ${MAX_SELECTED_SOURCES} Quellen ausgewählt sein.`)
    }
  }

  const { error: updateError } = await service
    .from("sources")
    .update({ is_selected: selected })
    .eq("id", ownedSource.id)
    .eq("user_id", userId)
  if (updateError) throw new Error("Quellenauswahl konnte nicht gespeichert werden.")

  return { isSelected: selected, notebookId: ownedSource.notebook_id }
}
