"use server"

import { revalidatePath } from "next/cache"
import { notFound, redirect } from "next/navigation"

import { requireUser } from "@/lib/auth/authorize"
import { HttpError } from "@/lib/http/errors"
import { runNextIngestionJob } from "@/lib/ingestion/run-job"
import {
  cancelUploadForContext,
  confirmUploadForContext,
  type PrepareUploadInput,
  type PrepareUploadResult,
  prepareUploadForContext,
  retryIngestionForContext,
} from "@/lib/ingestion/upload"
import { importWebSourcesForContext, type WebImportResult } from "@/lib/ingestion/web-import"
import {
  createNotebookForContext,
  deleteNotebookForContext,
  renameNotebookForContext,
} from "@/lib/notebooks/service"
import { createServiceSupabaseClient } from "@/lib/supabase/service"

export interface NotebookActionState {
  error?: string
}

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

function actionError(error: unknown): NotebookActionState {
  if (error instanceof HttpError) {
    if (error.status === 401) redirect("/sign-in")
    if (error.status === 404) notFound()
    if (error.status === 409 || error.status === 422) return { error: error.message }
  }

  throw error
}

export async function createNotebookAction(
  _previousState: NotebookActionState,
  formData: FormData,
): Promise<NotebookActionState> {
  try {
    const { userId } = await requireUser()
    await createNotebookForContext(
      { userId },
      stringField(formData, "name"),
      createServiceSupabaseClient(),
    )
    revalidatePath("/notebooks")
    return {}
  } catch (error) {
    return actionError(error)
  }
}

export async function renameNotebookAction(
  _previousState: NotebookActionState,
  formData: FormData,
): Promise<NotebookActionState> {
  const notebookId = stringField(formData, "id")

  try {
    const { userId } = await requireUser()
    await renameNotebookForContext(
      { userId },
      notebookId,
      stringField(formData, "name"),
      createServiceSupabaseClient(),
    )
    revalidatePath(`/notebooks/${notebookId}`)
    revalidatePath("/notebooks")
    return {}
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteNotebookAction(
  _previousState: NotebookActionState,
  formData: FormData,
): Promise<NotebookActionState> {
  try {
    const { userId } = await requireUser()
    const notebookId = stringField(formData, "id")
    await deleteNotebookForContext(
      { userId },
      notebookId,
      stringField(formData, "confirmed") === "true",
      createServiceSupabaseClient(),
    )
  } catch (error) {
    return actionError(error)
  }

  revalidatePath("/notebooks")
  redirect("/notebooks")
}

export async function prepareUpload(input: PrepareUploadInput): Promise<PrepareUploadResult> {
  const { userId } = await requireUser()
  const prepared = await prepareUploadForContext({ userId }, input, createServiceSupabaseClient())
  if (prepared.decision === "ok") revalidatePath(`/notebooks/${input.notebookId}`)
  return prepared
}

export async function confirmUpload(sourceId: string): Promise<void> {
  const { userId } = await requireUser()
  const service = createServiceSupabaseClient()
  await confirmUploadForContext({ userId }, sourceId, service)
  await runNextIngestionJob(service, sourceId)
  revalidatePath(`/notebooks`)
}

export async function cancelUpload(sourceId: string): Promise<void> {
  const { userId } = await requireUser()
  await cancelUploadForContext({ userId }, sourceId, createServiceSupabaseClient())
  revalidatePath(`/notebooks`)
}

export async function retryIngestion(sourceId: string): Promise<void> {
  const { userId } = await requireUser()
  const service = createServiceSupabaseClient()
  await retryIngestionForContext({ userId }, sourceId, service)
  await runNextIngestionJob(service, sourceId)
  revalidatePath(`/notebooks`)
}

export async function importWebSources(
  notebookId: string,
  urls: string[],
): Promise<WebImportResult> {
  const { userId } = await requireUser()
  const service = createServiceSupabaseClient()
  const result = await importWebSourcesForContext({ userId }, { notebookId, urls }, service)
  for (const outcome of result.outcomes) {
    if (outcome.status === "started" && outcome.sourceId) {
      await runNextIngestionJob(service, outcome.sourceId)
    }
  }
  revalidatePath(`/notebooks/${notebookId}`)
  return result
}
