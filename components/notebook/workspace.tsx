"use client"

import { useRouter } from "next/navigation"

import { type ChatMessage, ChatThread } from "@/components/notebook/chat-thread"
import { QuestionInput } from "@/components/notebook/question-input"
import { SourceDetail } from "@/components/notebook/source-detail"
import { type NotebookSource, SourceList } from "@/components/notebook/source-list"
import { SourceUpload } from "@/components/notebook/source-upload"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { WorkspaceSource, WorkspaceSourceDetail } from "@/lib/notebooks/workspace-service"

function toNotebookSource(source: WorkspaceSource): NotebookSource {
  return {
    errorReason: source.errorReason,
    fileName: source.fileName,
    id: source.id,
    status: source.status as NotebookSource["status"],
  }
}

export function Workspace({
  messages,
  notebookId,
  selectedDetail,
  sources,
  starterQuestions,
  streaming,
}: {
  messages: ChatMessage[]
  notebookId: string
  selectedDetail: WorkspaceSourceDetail | null
  sources: WorkspaceSource[]
  starterQuestions: string[]
  streaming: boolean
}) {
  const router = useRouter()
  const selectSource = (sourceId: string) =>
    router.replace(`/notebooks/${notebookId}?source=${sourceId}`, { scroll: false })
  const returnToWorkspace = () => router.replace(`/notebooks/${notebookId}`, { scroll: false })

  return (
    <section
      aria-label="Arbeitsbereich"
      className="grid items-start gap-6 lg:grid-cols-[minmax(15rem,1fr)_minmax(22rem,1.5fr)_minmax(13rem,0.8fr)]"
    >
      <Card className="lg:col-start-1">
        <CardHeader>
          <CardTitle>Quellen</CardTitle>
          <CardDescription>Nur du kannst diese Quellen und ihren Text lesen.</CardDescription>
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

      <Card className="lg:col-start-2">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
          <CardDescription>
            Antworten erscheinen erst mit vollständig geprüften Belegen.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <ChatThread messages={messages} notebookId={notebookId} />
          <QuestionInput
            notebookId={notebookId}
            starterQuestions={starterQuestions}
            streaming={streaming}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-start-3">
        <CardHeader>
          <CardTitle>Studio</CardTitle>
          <CardDescription>Gesicherte Antworten erscheinen hier.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Noch keine Studio-Notizen vorhanden.</p>
        </CardContent>
      </Card>
    </section>
  )
}
