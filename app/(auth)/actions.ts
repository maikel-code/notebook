"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { safeNotebookReturnPath } from "@/lib/auth/return-path"
import { createServerSupabaseClient } from "@/lib/supabase/server"

const credentialsSchema = z.object({
  email: z.email("Bitte eine gültige E-Mail-Adresse eingeben."),
  password: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen lang sein."),
})

export interface AuthActionState {
  error?: string
  fieldErrors?: {
    email?: string
    password?: string
  }
}

function parseCredentials(
  formData: FormData,
):
  | { data: z.infer<typeof credentialsSchema>; success: true }
  | { state: AuthActionState; success: false } {
  const result = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!result.success) {
    const fields = z.flattenError(result.error).fieldErrors
    return {
      state: {
        fieldErrors: {
          email: fields.email?.[0],
          password: fields.password?.[0],
        },
      },
      success: false,
    }
  }

  return { data: result.data, success: true }
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = parseCredentials(formData)
  if (!credentials.success) return credentials.state

  const client = await createServerSupabaseClient()
  const { error } = await client.auth.signUp(credentials.data)
  if (error) {
    return { error: "Das Konto konnte nicht angelegt werden." }
  }

  redirect(safeNotebookReturnPath(formData.get("next")))
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = parseCredentials(formData)
  if (!credentials.success) return credentials.state

  const client = await createServerSupabaseClient()
  const { error } = await client.auth.signInWithPassword(credentials.data)
  if (error) {
    return { error: "E-Mail-Adresse oder Passwort ist falsch." }
  }

  redirect(safeNotebookReturnPath(formData.get("next")))
}

export async function signOutAction(): Promise<never> {
  const client = await createServerSupabaseClient()
  await client.auth.signOut()
  redirect("/sign-in")
}
