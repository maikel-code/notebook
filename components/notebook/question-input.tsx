"use client"

import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"

export function QuestionInput({
  notebookId,
  starterQuestions = [],
  streaming = false,
}: {
  notebookId: string
  starterQuestions?: string[]
  streaming?: boolean
}) {
  const router = useRouter()
  const [question, setQuestion] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [terminalMessage, setTerminalMessage] = useState<string | null>(null)
  const [streamedClaims, setStreamedClaims] = useState<string[]>([])
  const abortController = useRef<AbortController | null>(null)
  const [pending, startTransition] = useTransition()
  const submit = () =>
    startTransition(async () => {
      setError(null)
      setTerminalMessage(null)
      setStreamedClaims([])
      const controller = new AbortController()
      abortController.current = controller
      try {
        const response = await fetch("/api/chat", {
          body: JSON.stringify({ notebookId, question }),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: controller.signal,
        })
        if (response.headers.get("content-type")?.includes("text/event-stream")) {
          const reader = response.body?.getReader()
          if (!reader) throw new Error("Antwortstream fehlt.")
          const decoder = new TextDecoder()
          let buffer = ""
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const events = buffer.split("\n\n")
            buffer = events.pop() ?? ""
            for (const event of events) {
              const data = event
                .split("\n")
                .find((line) => line.startsWith("data: "))
                ?.slice(6)
              if (!data) continue
              const payload = JSON.parse(data) as { text?: string; type?: string }
              if (payload.type === "claim" && payload.text) {
                setStreamedClaims((claims) => [...claims, payload.text as string])
              }
              if (payload.type === "error" && payload.text) setError(payload.text)
            }
          }
          setQuestion("")
          return
        }
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
      {starterQuestions.length ? (
        <fieldset className="grid gap-2">
          <legend className="font-medium">Erste Fragen übernehmen und bearbeiten</legend>
          <div className="flex flex-wrap gap-2">
            {starterQuestions.map((starterQuestion) => (
              <Button
                key={starterQuestion}
                disabled={pending || streaming}
                type="button"
                variant="outline"
                onClick={() => setQuestion(starterQuestion)}
              >
                {starterQuestion}
              </Button>
            ))}
          </div>
        </fieldset>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {terminalMessage ? <p role="status">{terminalMessage}</p> : null}
      {streamedClaims.map((claim) => (
        <p key={claim} aria-live="polite">
          {claim}
        </p>
      ))}
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
