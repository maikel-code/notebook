import { CitationChip } from "@/components/notebook/citation-chip"
import { RetryAnswerButton } from "@/components/notebook/retry-answer-button"
import { UnsupportedAnswer } from "@/components/notebook/unsupported-answer"
import { invalidCitationMessage } from "@/lib/rag/unsupported"

export interface ChatCitation {
  id: string
  pageStart: number
  quote: string
  sourceName: string
  sourceId: string | null
}
export interface ChatMessage {
  attemptNo: number | null
  citations: ChatCitation[]
  content: string
  id: string
  messageKind: "answer" | "source_orientation"
  role: "assistant" | "user"
  status: string
  suggestedQuestions: string[]
  unsupportedReason: string | null
}

export function ChatThread({
  messages,
  notebookId,
}: {
  messages: ChatMessage[]
  notebookId: string
}) {
  if (!messages.length) return <p>Noch keine Fragen gestellt.</p>
  return (
    <ol aria-label="Antwortversuche" className="grid gap-3">
      {messages.map((message) => (
        <li key={message.id} className="border-2 p-3">
          <p className="font-medium">
            {message.role === "user"
              ? "Frage"
              : message.messageKind === "source_orientation"
                ? "Erste Orientierung"
                : `Antwort${message.attemptNo ? ` · Versuch ${message.attemptNo}` : ""}`}
          </p>
          {message.unsupportedReason && message.status === "complete" ? (
            <UnsupportedAnswer>{message.content}</UnsupportedAnswer>
          ) : (
            message.content
              .split("\n\n")
              .map((paragraph) => <p key={`${message.id}-${paragraph}`}>{paragraph}</p>)
          )}
          {message.status === "streaming" ? <p aria-live="polite">wird geprüft</p> : null}
          {message.status === "invalid" ? (
            <>
              <p role="status">{invalidCitationMessage}</p>
              <p>Der Entwurf wurde nicht als belegte Antwort übernommen.</p>
            </>
          ) : null}
          {message.citations.map((citation) =>
            citation.sourceId ? (
              <CitationChip
                key={citation.id}
                notebookId={notebookId}
                pageStart={citation.pageStart}
                quote={citation.quote}
                sourceId={citation.sourceId}
                sourceName={citation.sourceName}
              />
            ) : null,
          )}
          {message.messageKind === "source_orientation" && message.suggestedQuestions.length ? (
            <div>
              <p className="mt-3 font-medium">Mögliche erste Fragen</p>
              <ul className="list-disc pl-5">
                {message.suggestedQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {message.status === "failed" ? (
            <>
              <p>fehlgeschlagen</p>
              <RetryAnswerButton messageId={message.id} notebookId={notebookId} />
            </>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
