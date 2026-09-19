"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireUser } from "@/lib/auth/authorize"
import {
  createNotebookForContext,
  deleteNotebookForContext,
  renameNotebookForContext,
} from "@/lib/notebooks/service"
import { createServiceSupabaseClient } from "@/lib/supabase/service"

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

export async function createNotebook(formData: FormData): Promise<void> {
  const { userId } = await requireUser()
  await createNotebookForContext(
    { userId },
    stringField(formData, "name"),
    createServiceSupabaseClient(),
  )
  revalidatePath("/notebooks")
}

export async function renameNotebook(formData: FormData): Promise<void> {
  const { userId } = await requireUser()
  const notebookId = stringField(formData, "id")
  await renameNotebookForContext(
    { userId },
    notebookId,
    stringField(formData, "name"),
    createServiceSupabaseClient(),
  )
  revalidatePath(`/notebooks/${notebookId}`)
  revalidatePath("/notebooks")
}

export async function deleteNotebook(formData: FormData): Promise<never> {
  const { userId } = await requireUser()
  const notebookId = stringField(formData, "id")
  await deleteNotebookForContext(
    { userId },
    notebookId,
    stringField(formData, "confirmed") === "true",
    createServiceSupabaseClient(),
  )
  revalidatePath("/notebooks")
  redirect("/notebooks")
}
