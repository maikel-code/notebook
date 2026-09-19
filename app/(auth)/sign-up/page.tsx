import { signUpAction } from "@/app/(auth)/actions"
import { AuthForm } from "@/components/auth/auth-form"

export default function SignUpPage() {
  return (
    <AuthForm
      action={signUpAction}
      alternateHref="/sign-in"
      alternateLabel="Bereits registriert? Anmelden"
      description="Lege deinen privaten Arbeitsbereich an."
      submitLabel="Registrieren"
      title="Konto anlegen"
    />
  )
}
