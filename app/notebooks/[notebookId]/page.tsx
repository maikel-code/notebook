import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { type ChatMessage, ChatThread } from "@/components/notebook/chat-thread"
import { ConfirmDeleteDialog } from "@/components/notebook/confirm-delete-dialog"
import { RenameNotebookForm } from "@/components/notebook/notebook-forms"
import { QuestionInput } from "@/components/notebook/question-input"
import { type NotebookSource, SourceList } from "@/components/notebook/source-list"
import { SourceUpload } from "@/components/notebook/source-upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireUser } from "@/lib/auth/authorize"
import { HttpError } from "@/lib/http/errors"
import { getNotebookForContext } from "@/lib/notebooks/service"
import { createServiceSupabaseClient } from "@/lib/supabase/service"

interface NotebookPageProps {
  params: Promise<{ notebookId: string }>
}

export default async function NotebookPage({ params }: NotebookPageProps) {
  const { notebookId } = await params
  try {
    const { userId } = await requireUser()
    const notebook = await getNotebookForContext(
      { userId },
      notebookId,
      createServiceSupabaseClient(),
    )
    const service = createServiceSupabaseClient()
    const { data: sourceRows, error: sourceError } = await service
      .from("sources")
      .select("id, file_name, status, error_reason")
      .eq("notebook_id", notebook.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
    if (sourceError) throw new Error("Quellen konnten nicht geladen werden.")
    const sources: NotebookSource[] = (
      (sourceRows ?? []) as Array<{
        error_reason: string | null
        file_name: string
        id: string
        status: string
      }>
    ).map((source) => ({
      errorReason: source.error_reason,
      fileName: source.file_name,
      id: source.id,
      status: source.status as NotebookSource["status"],
    }))
    const { data: messageRows, error: messageError } = await service
      .from("messages")
      .select(
        "id, role, content, status, unsupported_reason, attempt_no, created_at, citations(id, ordinal, source_id, source_name, quote, page_start)",
      )
      .eq("notebook_id", notebook.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
    if (messageError) throw new Error("Antworten konnten nicht geladen werden.")
    const rawMessageRows = (messageRows ?? []) as unknown as Array<{
      attempt_no: number | null
      citations: Array<{
        id: string
        ordinal: number
        page_start: number
        quote: string
        source_id: string | null
        source_name: string
      }> | null
      content: string
      id: string
      role: string
      status: string
      unsupported_reason: string | null
    }>
    const messages: ChatMessage[] = rawMessageRows.map((message) => ({
      attemptNo: message.attempt_no,
      citations: (
        (message.citations ?? []) as Array<{
          id: string
          ordinal: number
          page_start: number
          quote: string
          source_id: string | null
          source_name: string
        }>
      )
        .toSorted((left, right) => left.ordinal - right.ordinal)
        .map((citation) => ({
          id: citation.id,
          pageStart: citation.page_start,
          quote: citation.quote,
          sourceId: citation.source_id,
          sourceName: citation.source_name,
        })),
      content: message.content,
      id: message.id,
      role: message.role as ChatMessage["role"],
      status: message.status,
      unsupportedReason: message.unsupported_reason,
    }))
    const streaming = messages.some(
      (message) => message.role === "assistant" && message.status === "streaming",
    )

    return (
      <main className="mx-auto grid min-h-screen max-w-4xl content-start gap-8 px-4 py-10">
        <Button asChild variant="link" className="w-fit px-0">
          <Link href="/notebooks">← Alle Notebooks</Link>
        </Button>
        <header>
          <p className="font-medium">Privates Notebook</p>
          <h1 className="font-head text-4xl">{notebook.name}</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Notebook umbenennen</CardTitle>
            <CardDescription>Der Name ist nur für dich sichtbar.</CardDescription>
          </CardHeader>
          <CardContent>
            <RenameNotebookForm notebookId={notebook.id} notebookName={notebook.name} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fragen und Antworten</CardTitle>
            <CardDescription>
              Antworten erscheinen erst mit vollständig geprüften Belegen.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <ChatThread messages={messages} notebookId={notebook.id} />
            <QuestionInput notebookId={notebook.id} streaming={streaming} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quellen</CardTitle>
            <CardDescription>Nur textbasierte PDFs bis 10 MB und 50 Seiten.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <SourceUpload notebookId={notebook.id} />
            <SourceList notebookId={notebook.id} sources={sources} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notebook löschen</CardTitle>
            <CardDescription>Diese Aktion entfernt alle zugehörigen Daten.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmDeleteDialog notebookId={notebook.id} notebookName={notebook.name} />
          </CardContent>
        </Card>
      </main>
    )
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401) redirect("/sign-in")
      if (error.status === 404) notFound()
    }
    throw error
  }
}
