"use client"

import { useRouter } from "next/navigation"

import { type ChatMessage, ChatThread } from "@/components/notebook/chat-thread"
import { QuestionInput } from "@/components/notebook/question-input"
import { SourceDetail } from "@/components/notebook/source-detail"
import { type NotebookSource, SourceList } from "@/components/notebook/source-list"
import { SourceSearch } from "@/components/notebook/source-search"
import { SourceUpload } from "@/components/notebook/source-upload"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { WorkspaceSource, WorkspaceSourceDetail } from "@/lib/notebooks/workspace-service"
import {Separator} from "@/components/ui/separator";

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
          <CardTitle className="text-3xl font-bold tracking-tight text-balance">Studio</CardTitle>
          <CardDescription>Gesicherte Antworten erscheinen hier.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Noch keine Studio-Notizen vorhanden.</p>
        </CardContent>
      </Card>
    </section>
  )
}
