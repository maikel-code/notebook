"use client"

import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"

export function QuestionInput({
  notebookId,
  streaming = false,
}: {
  notebookId: string
  streaming?: boolean
}) {
  const router = useRouter()
  const [question, setQuestion] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [terminalMessage, setTerminalMessage] = useState<string | null>(null)
  const abortController = useRef<AbortController | null>(null)
  const [pending, startTransition] = useTransition()
  const submit = () =>
    startTransition(async () => {
      setError(null)
      setTerminalMessage(null)
      const controller = new AbortController()
      abortController.current = controller
      try {
        const response = await fetch("/api/chat", {
          body: JSON.stringify({ notebookId, question }),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: controller.signal,
        })
        const data = (await response.json()) as { content?: string; error?: string }
        if (!response.ok) setError(data.error ?? "Die Frage konnte nicht gesendet werden.")
        else {
          setQuestion("")
          setTerminalMessage(data.content ?? null)
        }
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setError("Die Frage konnte nicht gesendet werden.")
        }
      } finally {
        abortController.current = null
        router.refresh()
      }
    })
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label className="grid gap-1" htmlFor="question">
        <span className="font-medium">Frage an das Notebook</span>
        <textarea
          id="question"
          value={question}
          disabled={pending || streaming}
          maxLength={2000}
          onChange={(event) => setQuestion(event.target.value)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      {terminalMessage ? <p role="status">{terminalMessage}</p> : null}
      {pending ? <p aria-live="polite">wird geprüft</p> : null}
      {pending ? (
        <Button type="button" variant="outline" onClick={() => abortController.current?.abort()}>
          Abbrechen
        </Button>
      ) : null}
      <Button disabled={!question.trim() || pending || streaming} type="submit">
        Frage senden
      </Button>
    </form>
  )
}
