import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import type { ChatMessage } from "@/components/notebook/chat-thread"
import { ConfirmDeleteDialog } from "@/components/notebook/confirm-delete-dialog"
import { RenameNotebookForm } from "@/components/notebook/notebook-forms"
import { Workspace } from "@/components/notebook/workspace"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireUser } from "@/lib/auth/authorize"
import { HttpError } from "@/lib/http/errors"
import {
  getSourceDetailForContext,
  getWorkspaceSnapshotForContext,
} from "@/lib/notebooks/workspace-service"
import { createServiceSupabaseClient } from "@/lib/supabase/service"

interface NotebookPageProps {
  params: Promise<{ notebookId: string }>
  searchParams: Promise<{ source?: string | string[] }>
}

export default async function NotebookPage({ params, searchParams }: NotebookPageProps) {
  const { notebookId } = await params
  const selectedSourceParam = (await searchParams).source
  const selectedSourceId = typeof selectedSourceParam === "string" ? selectedSourceParam : null
  try {
    const { userId } = await requireUser()
    const service = createServiceSupabaseClient()
    const workspace = await getWorkspaceSnapshotForContext({ userId }, notebookId, service)
    const notebook = workspace.notebook
    const selectedDetail = selectedSourceId
      ? await getSourceDetailForContext({ userId }, notebookId, selectedSourceId, service)
      : null
    const { data: messageRows, error: messageError } = await service
      .from("messages")
      .select(
        "id, role, content, status, message_kind, suggested_questions, unsupported_reason, attempt_no, created_at, citations(id, ordinal, source_id, source_name, quote, page_start, sources(source_kind, origin_url))",
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
        sources: { origin_url: string | null; source_kind: "pdf" | "web" } | null
      }> | null
      content: string
      id: string
      message_kind: "answer" | "source_orientation"
      role: string
      status: string
      suggested_questions: unknown
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
          sources: { origin_url: string | null; source_kind: "pdf" | "web" } | null
        }>
      )
        .toSorted((left, right) => left.ordinal - right.ordinal)
        .map((citation) => ({
          id: citation.id,
          originUrl: citation.sources?.origin_url ?? null,
          pageStart: citation.page_start,
          quote: citation.quote,
          sourceId: citation.source_id,
          sourceKind: citation.sources?.source_kind ?? null,
          sourceName: citation.source_name,
        })),
      content: message.content,
      id: message.id,
      messageKind: message.message_kind,
      role: message.role as ChatMessage["role"],
      status: message.status,
      suggestedQuestions: Array.isArray(message.suggested_questions)
        ? message.suggested_questions.filter(
            (question): question is string => typeof question === "string",
          )
        : [],
      unsupportedReason: message.unsupported_reason,
    }))
    const starterQuestions =
      messages.filter((message) =>  message.role === "assistant").pop()?.suggestedQuestions || []

    const streaming = messages.some(
      (message) => message.role === "assistant" && message.status === "streaming",
    )

    return (
      <main className="mx-auto grid min-h-screen max-w-full content-start gap-6 px-4 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <Button asChild variant="outline" className="w-fit px-2  ">
            <Link href="/notebooks" title="Alle Notebooks">←</Link>
          </Button>
          <header>
            <RenameNotebookForm notebookId={notebook.id} notebookName={notebook.name} />
          </header>
          <div className="ml-auto ">
            <ConfirmDeleteDialog notebookId={notebook.id} notebookName={notebook.name} />
          </div>
        </div>

        <Workspace
          messages={messages}
          notebookId={notebook.id}
          selectedDetail={selectedDetail}
          sources={workspace.sources}
          starterQuestions={starterQuestions}
          streaming={streaming}
        />
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
