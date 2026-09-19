import { signInAction } from "@/app/(auth)/actions"
import { AuthForm } from "@/components/auth/auth-form"

interface SignInPageProps {
  searchParams: Promise<{ next?: string }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next } = await searchParams
  const nextPath = typeof next === "string" ? next : undefined

  return (
    <AuthForm
      action={signInAction}
      alternateHref={nextPath ? `/sign-up?next=${encodeURIComponent(nextPath)}` : "/sign-up"}
      alternateLabel="Konto anlegen"
      description="Melde dich an, um deine Notebooks zu öffnen."
      nextPath={nextPath}
      submitLabel="Anmelden"
      title="Willkommen zurück"
    />
  )
}
