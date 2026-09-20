"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"

export function RetryAnswerButton({
  messageId,
  notebookId,
}: {
  messageId: string
  notebookId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await fetch("/api/chat", {
            body: JSON.stringify({ notebookId, retryOfMessageId: messageId }),
            headers: { "content-type": "application/json" },
            method: "POST",
          })
          router.refresh()
        })
      }
    >
      Erneut versuchen
    </Button>
  )
}
