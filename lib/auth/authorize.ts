import "server-only"

import type { User } from "@supabase/supabase-js"

import { unauthorizedError } from "@/lib/http/errors"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export { type OwnedNotebook, type RequestContext, requireOwnedNotebook } from "@/lib/auth/ownership"

export interface AuthorizationContext {
  user: User
  userId: string
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
