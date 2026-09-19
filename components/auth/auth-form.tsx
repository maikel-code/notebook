"use client"

import Link from "next/link"
import { useActionState, useEffect, useState } from "react"

import type { AuthActionState } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AuthFormProps {
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>
  alternateHref: string
  alternateLabel: string
  description: string
  submitLabel: string
  title: string
}

const initialState: AuthActionState = {}

export function AuthForm({
  action,
  alternateHref,
  alternateLabel,
  description,
  submitLabel,
  title,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="font-head text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-5" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
                aria-invalid={Boolean(state.fieldErrors?.email)}
                required
              />
              {state.fieldErrors?.email ? (
                <p id="email-error" className="text-sm font-medium text-destructive">
                  {state.fieldErrors.email}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={submitLabel === "Registrieren" ? "new-password" : "current-password"}
                aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
                aria-invalid={Boolean(state.fieldErrors?.password)}
                required
              />
              {state.fieldErrors?.password ? (
                <p id="password-error" className="text-sm font-medium text-destructive">
                  {state.fieldErrors.password}
                </p>
              ) : null}
            </div>
            {state.error ? (
              <p
                role="alert"
                className="border-2 border-destructive bg-card p-3 text-sm font-medium"
              >
                {state.error}
              </p>
            ) : null}
            <Button type="submit" disabled={!mounted || pending}>
              {pending ? "Bitte warten…" : submitLabel}
            </Button>
            <Button asChild variant="link">
              <Link href={alternateHref}>{alternateLabel}</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
