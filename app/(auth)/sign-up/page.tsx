import { signUpAction } from "@/app/(auth)/actions"
import { AuthForm } from "@/components/auth/auth-form"

interface SignUpPageProps {
  searchParams: Promise<{ next?: string }>
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { next } = await searchParams
  const nextPath = typeof next === "string" ? next : undefined

  return (
    <AuthForm
      action={signUpAction}
      alternateHref={nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in"}
      alternateLabel="Bereits registriert? Anmelden"
      description="Lege deinen privaten Arbeitsbereich an."
      nextPath={nextPath}
      submitLabel="Registrieren"
      title="Konto anlegen"
    />
  )
}
