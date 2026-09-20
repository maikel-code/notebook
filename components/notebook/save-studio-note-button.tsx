"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { saveStudioNote } from "@/app/notebooks/actions"
import { Button } from "@/components/ui/button"

export function SaveStudioNoteButton({
  messageId,
  notebookId,
}: {
  messageId: string
  notebookId: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        disabled={pending}
        type="button"
        variant="outline"
        onClick={() =>
          startTransition(async () => {
            setError(null)
            try {
              await saveStudioNote(messageId, notebookId)
              router.refresh()
            } catch {
              setError("Die Antwort konnte nicht als Notiz gespeichert werden.")
            }
          })
        }
      >
        {pending ? "Notiz wird gespeichert" : "In Notiz speichern"}
      </Button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}
