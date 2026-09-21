import { CitationChip } from "@/components/notebook/citation-chip"
import { RetryAnswerButton } from "@/components/notebook/retry-answer-button"
import { SaveStudioNoteButton } from "@/components/notebook/save-studio-note-button"
import { UnsupportedAnswer } from "@/components/notebook/unsupported-answer"
import { invalidCitationMessage } from "@/lib/rag/unsupported"
import {Fragment} from "react";

export interface ChatCitation {
  id: string
  originUrl?: string | null
  pageStart: number
  quote: string
  sourceName: string
  sourceId: string | null
  sourceKind?: "pdf" | "web" | null
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
  savedMessageIds,
}: {
  messages: ChatMessage[]
  notebookId: string
  savedMessageIds: ReadonlySet<string>
}) {
  if (!messages.length) return <p>Noch keine Fragen gestellt.</p>
  return (
    <div className="grid gap-4">
      {messages.map((message) => (
        <Fragment key={message.id}>
        <div
          className={`${message.role === "user" ? "border-2 max-w-10/12 ml-auto bg-accent" : "border-2 bg-background"} p-3 space-y-1.5`}
          title={
            message.messageKind === "source_orientation"
              ? "Erste Orientierung"
              : `Antwort${message.attemptNo ? ` · Versuch ${message.attemptNo}` : ""}`
          }
        >
          {message.unsupportedReason && message.status === "complete" ? (
            <UnsupportedAnswer>{message.content}</UnsupportedAnswer>
          ) : (
            message.content
              .split("\n\n")
              .map((paragraph) => <p key={`${message.id}-${paragraph}`}>{paragraph}</p>)
          )}
          {message.status === "streaming" ? <p aria-live="polite">wird geprüft</p> : null}
          {message.status === "invalid" ? (
            <div className="text-sm text-amber-600 italic" role="alert">
              <p role="status">{invalidCitationMessage}</p>
              <p>Der Entwurf wurde nicht als belegte Antwort übernommen.</p>
            </div>
          ) : null}
          {message.citations.map((citation) => (
            <CitationChip
              key={citation.id}
              notebookId={notebookId}
              originUrl={citation.originUrl}
              pageStart={citation.pageStart}
              quote={citation.quote}
              sourceId={citation.sourceId}
              sourceKind={citation.sourceKind}
              sourceName={citation.sourceName}
            />
          ))}
          {message.status === "failed" ? (
            <>
              <p>fehlgeschlagen</p>
              <RetryAnswerButton messageId={message.id} notebookId={notebookId} />
            </>
          ) : null}

        </div>
          {message.role === "assistant" &&
          message.messageKind === "answer" &&
          message.status === "complete" &&
          message.unsupportedReason === null &&
          !savedMessageIds.has(message.id) &&
          message.citations.length ? (
            <SaveStudioNoteButton messageId={message.id} notebookId={notebookId} />
          ) : null}
        </Fragment>
      ))}
    </div>
  )
}
