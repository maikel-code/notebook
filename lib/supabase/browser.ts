"use client"

import { createBrowserClient } from "@supabase/ssr"

import { getPublicEnvironment } from "@/lib/env.client"

export function createBrowserSupabaseClient() {
  const environment = getPublicEnvironment()
  return createBrowserClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
