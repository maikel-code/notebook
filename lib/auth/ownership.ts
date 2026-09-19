import type { SupabaseClient } from "@supabase/supabase-js"

import { notFoundError, unauthorizedError } from "@/lib/http/errors"

export interface RequestContext {
  userId: string
}

export interface OwnedNotebook {
  created_at: string
  id: string
  name: string
  updated_at: string
  user_id: string
}

export async function requireOwnedNotebook(
  context: RequestContext | null,
  notebookId: string,
  service: SupabaseClient,
): Promise<OwnedNotebook> {
  if (!context) {
    throw unauthorizedError()
  }

  const { data, error } = await service
    .from("notebooks")
    .select("id, user_id, name, created_at, updated_at")
    .eq("id", notebookId)
    .eq("user_id", context.userId)
    .maybeSingle()

  if (error || !data) {
    throw notFoundError()
  }

  return data as OwnedNotebook
}
