import { signInAction } from "@/app/(auth)/actions"
import { AuthForm } from "@/components/auth/auth-form"

export default function SignInPage() {
  return (
    <AuthForm
      action={signInAction}
      alternateHref="/sign-up"
      alternateLabel="Konto anlegen"
      description="Melde dich an, um deine Notebooks zu öffnen."
      submitLabel="Anmelden"
      title="Willkommen zurück"
    />
  )
}
