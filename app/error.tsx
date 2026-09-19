"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Unexpected application error", { digest: error.digest })
  }, [error.digest])

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-12">
      <section className="grid gap-4 border-2 bg-card p-6 shadow-md">
        <h1 className="font-head text-2xl">Das hat nicht funktioniert</h1>
        <p>Bitte versuche es erneut. Wenn das Problem bleibt, melde dich beim Support.</p>
        <Button className="w-fit" type="button" onClick={reset}>
          Erneut versuchen
        </Button>
      </section>
    </main>
  )
}
