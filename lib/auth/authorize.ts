import "server-only"

import type { User } from "@supabase/supabase-js"

import { notFoundError, unauthorizedError } from "@/lib/http/errors"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceSupabaseClient } from "@/lib/supabase/service"

export interface AuthorizationContext {
  user: User
  userId: string
}

export interface AuthorizedNotebook extends AuthorizationContext {
  notebook: {
    id: string
    name: string
    user_id: string
  }
}

export interface AuthorizedSource extends AuthorizationContext {
  source: {
    id: string
    notebook_id: string
    status: string
    user_id: string
  }
}

export async function requireUser(): Promise<AuthorizationContext> {
  const client = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await client.auth.getUser()

  if (error || !user) {
    throw unauthorizedError()
  }

  return { user, userId: user.id }
}

export async function authorizeNotebook(notebookId: string): Promise<AuthorizedNotebook> {
  const context = await requireUser()
  const service = createServiceSupabaseClient()
  const { data, error } = await service
    .from("notebooks")
    .select("id, name, user_id")
    .eq("id", notebookId)
    .eq("user_id", context.userId)
    .maybeSingle()

  if (error || !data) {
    throw notFoundError()
  }

  return { ...context, notebook: data }
}

export async function authorizeSource(sourceId: string): Promise<AuthorizedSource> {
  const context = await requireUser()
  const service = createServiceSupabaseClient()
  const { data, error } = await service
    .from("sources")
    .select("id, notebook_id, status, user_id")
    .eq("id", sourceId)
    .eq("user_id", context.userId)
    .maybeSingle()

  if (error || !data) {
    throw notFoundError()
  }

  return { ...context, source: data }
}
