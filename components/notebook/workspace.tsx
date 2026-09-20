"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { type ChatMessage, ChatThread } from "@/components/notebook/chat-thread"
import { QuestionInput } from "@/components/notebook/question-input"
import { SourceDetail } from "@/components/notebook/source-detail"
import { type NotebookSource, SourceList } from "@/components/notebook/source-list"
import { SourceSearch } from "@/components/notebook/source-search"
import { SourceUpload } from "@/components/notebook/source-upload"
import { StudioNotes } from "@/components/notebook/studio-notes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type {
  WorkspaceNotePreview,
  WorkspaceSource,
  WorkspaceSourceDetail,
} from "@/lib/notebooks/workspace-service"
import type { StudioNote } from "@/lib/studio/service"

function toNotebookSource(source: WorkspaceSource): NotebookSource {
  return {
    errorReason: source.errorReason,
    fileName: source.fileName,
    id: source.id,
    sourceKind: source.sourceKind,
    status: source.status as NotebookSource["status"],
  }
}

export function Workspace({
  messages,
  notebookId,
  notes,
  selectedNote,
  selectedDetail,
  sources,
  starterQuestions,
  streaming,
}: {
  messages: ChatMessage[]
  notebookId: string
  notes: WorkspaceNotePreview[]
  selectedNote: StudioNote | null
  selectedDetail: WorkspaceSourceDetail | null
  sources: WorkspaceSource[]
  starterQuestions: string[]
  streaming: boolean
}) {
  const router = useRouter()
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([])
  useEffect(() => {
    setOptimisticMessages((current) =>
      current.filter(
        (optimistic) =>
          !messages.some(
            (message) => message.role === "user" && message.content === optimistic.content,
          ),
      ),
    )
  }, [messages])
  const addOptimisticQuestion = (content: string) => {
    const id = `optimistic-${crypto.randomUUID()}`
    setOptimisticMessages((current) => [
      ...current,
      {
        attemptNo: null,
        citations: [],
        content,
        id,
        messageKind: "answer",
        role: "user",
        status: "complete",
        suggestedQuestions: [],
        unsupportedReason: null,
      },
    ])
    return id
  }
  const removeOptimisticQuestion = (id: string) =>
    setOptimisticMessages((current) => current.filter((message) => message.id !== id))
  const selectSource = (sourceId: string) =>
    router.replace(`/notebooks/${notebookId}?source=${sourceId}`, { scroll: false })
  const returnToWorkspace = () => router.replace(`/notebooks/${notebookId}`, { scroll: false })
  const refresh = () => router.refresh()

  return (
    <section
      aria-label="Arbeitsbereich"
      className="grid items-start gap-6 lg:grid-cols-[minmax(15rem,1fr)_minmax(22rem,1.5fr)_minmax(13rem,0.8fr)]"
    >
      <Card className="lg:col-start-1">
        <CardHeader>
          <CardTitle className="text-3xl font-bold tracking-tight text-balance">Quellen</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          {selectedDetail ? (
            <SourceDetail
              detail={selectedDetail}
              key={selectedDetail.source.id}
              onReturn={returnToWorkspace}
            />
          ) : (
            <>
              <SourceUpload notebookId={notebookId} />
              <Separator />
              <SourceSearch notebookId={notebookId} onImported={refresh} />
              <Separator />
              <SourceList
                notebookId={notebookId}
                selectedSourceId={null}
                sources={sources.map(toNotebookSource)}
                onSelect={selectSource}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-start-2 ">
        <CardHeader>
          <CardTitle className="text-3xl font-bold tracking-tight text-balance">Chat</CardTitle>
          <CardDescription>
            {messages.length ? "" : "Antworten erscheinen erst mit vollständig geprüften Belegen."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <ChatThread messages={[...messages, ...optimisticMessages]} notebookId={notebookId} />
          <QuestionInput
            notebookId={notebookId}
            onQuestionRejected={removeOptimisticQuestion}
            onQuestionSubmitted={addOptimisticQuestion}
            starterQuestions={starterQuestions}
            streaming={streaming}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-start-3">
        <CardHeader>
          <CardTitle className="text-3xl font-bold tracking-tight text-balance">Studio</CardTitle>
          <CardDescription>Gesicherte Antworten erscheinen hier.</CardDescription>
        </CardHeader>
        <CardContent>
          <StudioNotes
            notebookId={notebookId}
            notes={notes}
            selectedNote={selectedNote}
            onSelect={(noteId) =>
              router.replace(`/notebooks/${notebookId}?note=${noteId}`, { scroll: false })
            }
          />
        </CardContent>
      </Card>
    </section>
  )
}
