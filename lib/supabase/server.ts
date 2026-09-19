import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getServerEnvironment } from "@/lib/env"

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const environment = getServerEnvironment()

  return createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Components cannot write cookies. Middleware refreshes the session.
          }
        },
      },
    },
  )
}
