import "server-only"

import { z } from "zod"

const serverEnvironmentSchema = z
  .object({
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    JOB_TRIGGER_SECRET: z.string().min(32),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NOTEBOOK_CHAT_MODEL: z.string().min(1).optional(),
    NOTEBOOK_CHAT_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
    OPENAI_API_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  })
  .superRefine((environment, context) => {
    if (environment.NOTEBOOK_CHAT_PROVIDER === "anthropic" && !environment.ANTHROPIC_API_KEY) {
      context.addIssue({
        code: "custom",
        message: "ANTHROPIC_API_KEY ist für NOTEBOOK_CHAT_PROVIDER=anthropic erforderlich.",
        path: ["ANTHROPIC_API_KEY"],
      })
    }
  })

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>

let cachedEnvironment: ServerEnvironment | undefined

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= serverEnvironmentSchema.parse(process.env)
  return cachedEnvironment
}

export function parseServerEnvironment(input: unknown): ServerEnvironment {
  return serverEnvironmentSchema.parse(input)
}
