import { randomUUID } from "node:crypto"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { z } from "zod"

config({ path: ".env.local", quiet: true })

const integrationEnvironmentSchema = z.object({
  JOB_TRIGGER_SECRET: z.string().min(32),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z
    .url()
    .refine(
      (value) => value.startsWith("http://127.0.0.1:") || value.startsWith("http://localhost:"),
      "Integration tests must target local Supabase",
    ),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

export const integrationEnvironment = integrationEnvironmentSchema.parse(process.env)
export const missingJobSecret = undefined
export const invalidJobSecret = "invalid-job-trigger-secret"

export function createAnonymousClient(): SupabaseClient {
  return createClient(
    integrationEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    integrationEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export function createIntegrationServiceClient(): SupabaseClient {
  return createClient(
    integrationEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    integrationEnvironment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export interface IntegrationUser {
  client: SupabaseClient
  email: string
  id: string
  password: string
}

export interface IntegrationFixture {
  anonymous: SupabaseClient
  cleanup: () => Promise<void>
  owner: IntegrationUser
  service: SupabaseClient
  stranger: IntegrationUser
}

async function createIntegrationUser(
  service: SupabaseClient,
  label: string,
): Promise<IntegrationUser> {
  const password = "Local-test-password-42!"
  const email = `${label}-${randomUUID()}@example.test`
  const { data, error } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  })

  if (error || !data.user) {
    throw error ?? new Error("Test user was not created")
  }

  const client = createAnonymousClient()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) {
    throw signInError
  }

  return { client, email, id: data.user.id, password }
}

export async function createIntegrationFixture(): Promise<IntegrationFixture> {
  const service = createIntegrationServiceClient()
  const owner = await createIntegrationUser(service, "owner")
  const stranger = await createIntegrationUser(service, "stranger")

  return {
    anonymous: createAnonymousClient(),
    owner,
    service,
    stranger,
    async cleanup() {
      await service.auth.admin.deleteUser(owner.id)
      await service.auth.admin.deleteUser(stranger.id)
    },
  }
}

export function testContext(user: IntegrationUser | null): { userId: string } | null {
  return user ? { userId: user.id } : null
}
