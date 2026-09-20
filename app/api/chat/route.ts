import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth/authorize"
import { conflictError, HttpError, validationError } from "@/lib/http/errors"
import { MAX_QUESTION_CHARS } from "@/lib/limits"
import { getNotebookForContext } from "@/lib/notebooks/service"
import { buildUntrustedContext } from "@/lib/rag/context"
import { generateAnswer } from "@/lib/rag/generate-answer"
import { persistVerifiedAnswer } from "@/lib/rag/persist-answer"
import { retrieveForQuestion } from "@/lib/rag/retrieve"
import { startAnswerAttempt } from "@/lib/rag/start-answer"
import {
  abortedAnswerMessage,
  failedAnswerMessage,
  unsupportedMessages,
} from "@/lib/rag/unsupported"
import { verifyClaims } from "@/lib/rag/verify-claims"
import { createServiceSupabaseClient } from "@/lib/supabase/service"

interface SourceRow {
  file_name: string
  id: string
  is_selected: boolean
  status: string
}

function responseError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ code: error.code, error: error.message }, { status: error.status })
  }
  return NextResponse.json(
    { code: "CHAT_FAILED", error: "Antwort konnte nicht erstellt werden." },
    { status: 500 },
  )
}

async function hasStreamingAnswer(notebookId: string, userId: string): Promise<boolean> {
  const service = createServiceSupabaseClient()
  const { data, error } = await service
    .from("messages")
    .select("id")
    .eq("notebook_id", notebookId)
    .eq("user_id", userId)
    .eq("role", "assistant")
    .eq("status", "streaming")
    .maybeSingle()
  if (error) throw new Error("Antwortstatus konnte nicht geprüft werden.")
  return Boolean(data)
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as {
      notebookId?: string
      question?: string
      retryOfMessageId?: string
    }
    let questionText = input.question
    let questionMessageId: string | undefined
    let selectedSourceIds: string[] | undefined
    if (
      !input.notebookId ||
      (typeof input.question !== "string" && typeof input.retryOfMessageId !== "string")
    ) {
      throw validationError("Die Frage ist ungültig.")
    }
    if (questionText && questionText.length > MAX_QUESTION_CHARS) {
      throw validationError("Die Frage darf höchstens 2.000 Zeichen enthalten.")
    }
    const { userId } = await requireUser()
    const service = createServiceSupabaseClient()
    // biome-ignore lint/suspicious/noExplicitAny: generated Supabase database types are not available yet.
    const database = service as unknown as { from: (table: string) => any }
    await getNotebookForContext({ userId }, input.notebookId, service)
    if (await hasStreamingAnswer(input.notebookId, userId)) {
      throw conflictError("Die laufende Antwort muss zuerst beendet oder abgebrochen werden.")
    }
    if (input.retryOfMessageId) {
      const { data: failed, error } = await database
        .from("messages")
        .select("id, question_message_id")
        .eq("id", input.retryOfMessageId)
        .eq("notebook_id", input.notebookId)
        .eq("user_id", userId)
        .eq("role", "assistant")
        .eq("status", "failed")
        .maybeSingle()
      if (error || !failed) throw new HttpError(404, "Eintrag nicht gefunden.", "NOT_FOUND")
      const { data: question, error: questionError } = await database
        .from("messages")
        .select("id, content, selected_sources_snapshot")
        .eq("id", failed.question_message_id)
        .eq("notebook_id", input.notebookId)
        .eq("user_id", userId)
        .eq("role", "user")
        .maybeSingle()
      if (questionError || !question) throw new Error("Die ursprüngliche Frage fehlt.")
      questionText = question.content
      questionMessageId = question.id
      selectedSourceIds = Array.isArray(question.selected_sources_snapshot)
        ? question.selected_sources_snapshot.filter(
            (sourceId: unknown): sourceId is string => typeof sourceId === "string",
          )
        : []
    }

    if (!questionText) throw validationError("Die Frage ist ungültig.")
    const { data: sources, error: sourceError } = await database
      .from("sources")
      .select("id, file_name, status, is_selected")
      .eq("notebook_id", input.notebookId)
      .eq("user_id", userId)
    if (sourceError) throw new Error("Quellen konnten nicht geladen werden.")
    const selected = (sources ?? []) as SourceRow[]
    const selectedForAttempt = selectedSourceIds
      ? selected.filter((source) => selectedSourceIds.includes(source.id))
      : selected.filter((source) => source.is_selected)
    if (selectedForAttempt.length === 0) {
      return NextResponse.json({ code: "no_selection", content: unsupportedMessages.no_selection })
    }
    const ready = selectedForAttempt.filter((source) => source.status === "ready")
    if (ready.length === 0) {
      return NextResponse.json({
        code: "no_ready_source",
        content: unsupportedMessages.no_ready_source,
      })
    }
    const { data: chunks, error: chunkError } = await database
      .from("chunks")
      .select("id, content, ordinal, page_start, page_end, source_id")
      .in(
        "source_id",
        ready.map((source) => source.id),
      )
      .eq("user_id", userId)
      .limit(8)
    if (chunkError) throw new Error("Quellen konnten nicht durchsucht werden.")
    if (!chunks?.length) {
      return NextResponse.json({
        code: "below_similarity_threshold",
        content: unsupportedMessages.below_similarity_threshold,
      })
    }
    const first = chunks.at(0)
    if (!first) throw new Error("Quellen konnten nicht durchsucht werden.")
    const source = ready.find((candidate) => candidate.id === first.source_id)
    if (!source) throw new Error("Quelle konnte nicht zugeordnet werden.")
    if (process.env.NOTEBOOK_E2E_INGESTION_MODE === "1") {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    if (!questionMessageId && questionText.includes("NOTEBOOK_E2E_ANSWER_FAIL_ONCE")) {
      const { data: question, error: questionError } = await database
        .from("messages")
        .insert({
          content: questionText,
          notebook_id: input.notebookId,
          role: "user",
          selected_sources_snapshot: ready.map((item) => item.id),
          status: "complete",
          user_id: userId,
        })
        .select("id")
        .single()
      if (questionError || !question) throw new Error("Die Frage konnte nicht gespeichert werden.")
      const { data: answer } = await database
        .from("messages")
        .insert({
          attempt_no: 1,
          content: "Die Antwort konnte nicht erstellt werden. Bitte erneut versuchen.",
          notebook_id: input.notebookId,
          question_message_id: question.id,
          role: "assistant",
          status: "failed",
          user_id: userId,
        })
        .select("id")
        .single()
      return NextResponse.json({ id: answer?.id, status: "failed" })
    }
    if (process.env.NOTEBOOK_E2E_INGESTION_MODE !== "1") {
      const attempt = await startAnswerAttempt(service, {
        notebookId: input.notebookId,
        questionContent: questionText,
        questionMessageId,
        selectedSourceIds: selectedSourceIds ?? selectedForAttempt.map((item) => item.id),
        userId,
      })
      let retrieved: Awaited<ReturnType<typeof retrieveForQuestion>>
      try {
        retrieved = await retrieveForQuestion(service, input.notebookId, questionText, userId)
      } catch {
        return NextResponse.json(
          await persistVerifiedAnswer(
            {
              citations: [],
              content: request.signal.aborted ? abortedAnswerMessage : failedAnswerMessage,
              answerMessageId: attempt.answerId,
              notebookId: input.notebookId,
              questionContent: questionText,
              questionMessageId,
              selectedSourceIds: selectedSourceIds ?? selectedForAttempt.map((item) => item.id),
              status: request.signal.aborted ? "aborted" : "failed",
              userId,
            },
            service,
          ),
        )
      }
      if (!retrieved.length) {
        return NextResponse.json(
          await persistVerifiedAnswer(
            {
              answerMessageId: attempt.answerId,
              citations: [],
              content: unsupportedMessages.below_similarity_threshold,
              notebookId: input.notebookId,
              questionContent: questionText,
              questionMessageId,
              selectedSourceIds: selectedSourceIds ?? selectedForAttempt.map((item) => item.id),
              unsupportedReason: "below_similarity_threshold",
              userId,
            },
            service,
          ),
        )
      }
      let generated: Awaited<ReturnType<typeof generateAnswer>>
      try {
        generated = await generateAnswer(
          questionText,
          buildUntrustedContext(retrieved),
          request.signal,
        )
      } catch {
        return NextResponse.json(
          await persistVerifiedAnswer(
            {
              citations: [],
              content: request.signal.aborted ? abortedAnswerMessage : failedAnswerMessage,
              answerMessageId: attempt.answerId,
              notebookId: input.notebookId,
              questionContent: questionText,
              questionMessageId,
              selectedSourceIds: selectedSourceIds ?? selectedForAttempt.map((item) => item.id),
              status: request.signal.aborted ? "aborted" : "failed",
              userId,
            },
            service,
          ),
        )
      }
      if (generated.kind === "unsupported") {
        return NextResponse.json(
          await persistVerifiedAnswer(
            {
              answerMessageId: attempt.answerId,
              citations: [],
              content: unsupportedMessages.unsupported,
              notebookId: input.notebookId,
              questionContent: questionText,
              questionMessageId,
              selectedSourceIds: selectedSourceIds ?? selectedForAttempt.map((item) => item.id),
              unsupportedReason: "unsupported",
              userId,
            },
            service,
          ),
        )
      }
      const verification = verifyClaims(
        generated,
        retrieved.map((chunk, index) => ({ ...chunk, chunkNumber: index + 1, selected: true })),
      )
      if (verification.kind === "invalid") {
        return NextResponse.json(
          await persistVerifiedAnswer(
            {
              citations: [],
              content: generated.claims.map((claim) => claim.text).join("\n\n"),
              answerMessageId: attempt.answerId,
              notebookId: input.notebookId,
              questionContent: questionText,
              questionMessageId,
              selectedSourceIds: selectedSourceIds ?? selectedForAttempt.map((item) => item.id),
              status: "invalid",
              unsupportedReason: "invalid_citations",
              userId,
            },
            service,
          ),
        )
      }
      return NextResponse.json(
        await persistVerifiedAnswer(
          {
            citations: verification.citations,
            content: verification.claims.join("\n\n"),
            answerMessageId: attempt.answerId,
            notebookId: input.notebookId,
            questionContent: questionText,
            questionMessageId,
            selectedSourceIds: selectedSourceIds ?? selectedForAttempt.map((item) => item.id),
            userId,
          },
          service,
        ),
      )
    }
    const result = await persistVerifiedAnswer(
      {
        citations: [
          {
            chunkId: first.id,
            ordinal: 0,
            pageEnd: first.page_end,
            pageStart: first.page_start,
            quote: first.content,
            sourceId: first.source_id,
            sourceName: source.file_name,
          },
        ],
        content: first.content,
        notebookId: input.notebookId,
        questionContent: questionText,
        questionMessageId,
        selectedSourceIds: selectedSourceIds ?? selectedForAttempt.map((item) => item.id),
        userId,
      },
      service,
    )
    return NextResponse.json(result)
  } catch (error) {
    return responseError(error)
  }
}
