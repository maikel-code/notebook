import "server-only"

import { z } from "zod"

const serverEnvironmentSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  JOB_TRIGGER_SECRET: z.string().min(32),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  OPENAI_API_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>

let cachedEnvironment: ServerEnvironment | undefined

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= serverEnvironmentSchema.parse(process.env)
  return cachedEnvironment
}
