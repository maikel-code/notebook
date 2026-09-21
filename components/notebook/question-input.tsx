"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"

export function QuestionInput({
  notebookId,
  starterQuestions = [],
  streaming = false,
  onQuestionSubmitted,
  onQuestionRejected,
}: {
  notebookId: string
  starterQuestions?: string[]
  streaming?: boolean
  onQuestionSubmitted?: (question: string) => string
  onQuestionRejected?: (optimisticId: string) => void
}) {
  const router = useRouter()
  const [question, setQuestion] = useState("")
  const [visibleStarterQuestions, setVisibleStarterQuestions] = useState(starterQuestions)
  const [error, setError] = useState<string | null>(null)
  const [terminalMessage, setTerminalMessage] = useState<string | null>(null)
  const abortController = useRef<AbortController | null>(null)
  const [pending, startTransition] = useTransition()
  useEffect(() => setVisibleStarterQuestions(starterQuestions), [starterQuestions])

  const submit = (questionToSend = question) => {
    const normalizedQuestion = questionToSend.trim()
    if (!normalizedQuestion) return
    const optimisticId = onQuestionSubmitted?.(normalizedQuestion)
    startTransition(async () => {
      setError(null)
      setTerminalMessage(null)
      const controller = new AbortController()
      abortController.current = controller
      try {
        const response = await fetch("/api/chat", {
          body: JSON.stringify({ notebookId, question: normalizedQuestion }),
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
              if (payload.type === "error" && payload.text) setError(payload.text)
            }
          }
          setQuestion("")
          return
        }
        const data = (await response.json()) as { content?: string; error?: string }
        if (!response.ok) {
          onQuestionRejected?.(optimisticId ?? "")
          setError(data.error ?? "Die Frage konnte nicht gesendet werden.")
        } else {
          onQuestionRejected?.(optimisticId ?? "")
          setQuestion("")
          setTerminalMessage(data.content ?? null)
        }
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          onQuestionRejected?.(optimisticId ?? "")
          setError("Die Frage konnte nicht gesendet werden.")
        }
      } finally {
        abortController.current = null
        router.refresh()
      }
    })
  }
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      {visibleStarterQuestions.length ? (
        <fieldset className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            {visibleStarterQuestions.map((starterQuestion) => (
              <Button
                size="xs"
                key={starterQuestion}
                disabled={pending || streaming}
                type="button"
                variant="secondary"
                className="rounded-full whitespace-normal "
                onClick={() => {
                  setVisibleStarterQuestions([])
                  submit(starterQuestion)
                }}
              >
                {starterQuestion}
              </Button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <InputGroup>
        <InputGroupTextarea
          id="question"
          placeholder="Frage an das Notebook"
          className="min-h-10"
          value={question}
          disabled={pending || streaming}
          maxLength={2000}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <InputGroupAddon align="block-end">
          <InputGroupText className="text-xs self-end">
            {question.length || 0}/2000{" "}
            {pending ? (
              <Badge variant="ghost" aria-live="polite">
                wird geprüft
              </Badge>
            ) : null}
          </InputGroupText>
          {pending ? (
            <InputGroupButton
              className="ml-auto"
              size="sm"
              type="button"
              variant="outline"
              onClick={() => abortController.current?.abort()}
            >
              Abbrechen
            </InputGroupButton>
          ) : (
            <InputGroupButton
              className="ml-auto"
              size="sm"
              variant="default"
              disabled={!question.trim() || pending || streaming}
              type="submit"
            >
              Frage senden
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      {error ? <p role="alert">{error}</p> : null}
      {terminalMessage ? <p role="status">{terminalMessage}</p> : null}
    </form>
  )
}
