import "server-only"

import { createClient } from "@supabase/supabase-js"

import { getServerEnvironment } from "@/lib/env"

let serviceClient: ReturnType<typeof createClient> | undefined

export function createServiceSupabaseClient() {
  if (serviceClient) {
    return serviceClient
  }

  const environment = getServerEnvironment()
  serviceClient = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )

  return serviceClient
}
