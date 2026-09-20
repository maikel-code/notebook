import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth/authorize"
import { conflictError, HttpError, validationError } from "@/lib/http/errors"
import { MAX_QUESTION_CHARS, MAX_SELECTED_SOURCES } from "@/lib/limits"
import { getNotebookForContext } from "@/lib/notebooks/service"
import { buildUntrustedContext } from "@/lib/rag/context"
import { generateFollowUpQuestions } from "@/lib/rag/follow-up-questions"
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
  // biome-ignore lint/suspicious/noExplicitAny: generated Supabase database types are not available yet.
  const database = service as unknown as { from: (table: string) => any }
  const { data, error } = await database
    .from("messages")
    .select("id, created_at")
    .eq("notebook_id", notebookId)
    .eq("user_id", userId)
    .eq("role", "assistant")
    .eq("status", "streaming")
    .maybeSingle()
  if (error) throw new Error("Antwortstatus konnte nicht geprüft werden.")
  if (data && new Date(data.created_at).getTime() < Date.now() - 5 * 60 * 1_000) {
    const { error: abortError } = await database
      .from("messages")
      .update({ content: abortedAnswerMessage, status: "aborted" })
      .eq("id", data.id)
      .eq("user_id", userId)
      .eq("status", "streaming")
    if (abortError) throw new Error("Antwortstatus konnte nicht bereinigt werden.")
    return false
  }
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
        .select("id, question_message_id, status")
        .eq("id", input.retryOfMessageId)
        .eq("notebook_id", input.notebookId)
        .eq("user_id", userId)
        .eq("role", "assistant")
        .maybeSingle()
      if (error || !failed) throw new HttpError(404, "Eintrag nicht gefunden.", "NOT_FOUND")
      if (failed.status !== "failed") {
        throw new HttpError(
          422,
          "Nur fehlgeschlagene Antworten können erneut versucht werden.",
          "INVALID_INPUT",
        )
      }
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
    if (selectedForAttempt.length > MAX_SELECTED_SOURCES) {
      throw validationError(`Es dürfen höchstens ${MAX_SELECTED_SOURCES} Quellen ausgewählt sein.`)
    }
    const ready = selectedForAttempt.filter((source) => source.status === "ready")
    if (ready.length === 0) {
      return NextResponse.json({
        code: "no_ready_source",
        content: unsupportedMessages.no_ready_source,
      })
    }
    const { data: availableChunks, error: availableChunksError } = await database
      .from("chunks")
      .select("id")
      .in(
        "source_id",
        ready.map((source) => source.id),
      )
      .eq("user_id", userId)
      .limit(1)
    if (availableChunksError) throw new Error("Quellen konnten nicht durchsucht werden.")
    if (!availableChunks?.length) {
      return NextResponse.json({
        code: "below_similarity_threshold",
        content: unsupportedMessages.below_similarity_threshold,
      })
    }
    let first:
      | { content: string; id: string; page_end: number; page_start: number; source_id: string }
      | undefined
    let source: SourceRow | undefined
    if (process.env.NOTEBOOK_E2E_INGESTION_MODE === "1") {
      const { data: chunks, error: chunkError } = await database
        .from("chunks")
        .select("id, content, page_start, page_end, source_id")
        .in(
          "source_id",
          ready.map((candidate) => candidate.id),
        )
        .eq("user_id", userId)
        .limit(8)
      if (chunkError || !chunks?.length) {
        return NextResponse.json({
          code: "below_similarity_threshold",
          content: unsupportedMessages.below_similarity_threshold,
        })
      }
      first = chunks.at(0)
      source = ready.find((candidate) => candidate.id === first?.source_id)
      if (!first || !source) throw new Error("Quelle konnte nicht zugeordnet werden.")
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    if (
      process.env.NOTEBOOK_E2E_INGESTION_MODE === "1" &&
      !questionMessageId &&
      questionText.includes("NOTEBOOK_E2E_ANSWER_FAIL_ONCE")
    ) {
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
      const question = questionText ?? ""
      const notebookId = input.notebookId ?? ""
      const attempt = await startAnswerAttempt(service, {
        notebookId,
        questionContent: question,
        questionMessageId,
        selectedSourceIds: selectedSourceIds ?? selectedForAttempt.map((item) => item.id),
        userId,
      })
      const encoder = new TextEncoder()
      const snapshot = selectedSourceIds ?? selectedForAttempt.map((item) => item.id)
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (payload: object) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
          const finish = () => {
            send({ type: "done" })
            controller.close()
          }
          try {
            const retrieved = await retrieveForQuestion(
              service,
              notebookId,
              question,
              userId,
              snapshot,
            )
            if (!retrieved.length) {
              await persistVerifiedAnswer(
                {
                  answerMessageId: attempt.answerId,
                  citations: [],
                  content: unsupportedMessages.below_similarity_threshold,
                  notebookId,
                  questionContent: question,
                  questionMessageId,
                  selectedSourceIds: snapshot,
                  unsupportedReason: "below_similarity_threshold",
                  userId,
                },
                service,
              )
              send({ text: unsupportedMessages.below_similarity_threshold, type: "terminal" })
              finish()
              return
            }
            const generated = await generateAnswer(
              question,
              buildUntrustedContext(retrieved),
              request.signal,
              (claim) => send({ text: claim.text, type: "claim" }),
            )
            if (generated.kind === "unsupported") {
              await persistVerifiedAnswer(
                {
                  answerMessageId: attempt.answerId,
                  citations: [],
                  content: unsupportedMessages.unsupported,
                  notebookId,
                  questionContent: question,
                  questionMessageId,
                  selectedSourceIds: snapshot,
                  unsupportedReason: "unsupported",
                  userId,
                },
                service,
              )
              send({ text: unsupportedMessages.unsupported, type: "terminal" })
              finish()
              return
            }
            const verification = verifyClaims(
              generated,
              retrieved.map((chunk, index) => ({
                ...chunk,
                chunkNumber: index + 1,
                selected: chunk.sourceSelected,
              })),
            )
            if (verification.kind === "invalid") {
              await persistVerifiedAnswer(
                {
                  answerMessageId: attempt.answerId,
                  citations: [],
                  content: generated.claims.map((claim) => claim.text).join("\n\n"),
                  notebookId,
                  questionContent: question,
                  questionMessageId,
                  selectedSourceIds: snapshot,
                  status: "invalid",
                  unsupportedReason: "invalid_citations",
                  userId,
                },
                service,
              )
            } else {
              const persisted = await persistVerifiedAnswer(
                {
                  answerMessageId: attempt.answerId,
                  citations: verification.citations,
                  content: verification.claims.join("\n\n"),
                  notebookId,
                  questionContent: question,
                  questionMessageId,
                  selectedSourceIds: snapshot,
                  userId,
                },
                service,
              )
              const suggestedQuestions = await generateFollowUpQuestions({
                answer: verification.claims.join("\n\n"),
                context: buildUntrustedContext(retrieved),
                question,
              })
              const { error: suggestionError } = await database
                .from("messages")
                .update({ suggested_questions: suggestedQuestions })
                .eq("id", persisted.id)
                .eq("notebook_id", notebookId)
                .eq("user_id", userId)
              if (suggestionError)
                console.error("Anschlussfragen konnten nicht gespeichert werden.")
            }
          } catch {
            const aborted = request.signal.aborted
            await persistVerifiedAnswer(
              {
                answerMessageId: attempt.answerId,
                citations: [],
                content: aborted ? abortedAnswerMessage : failedAnswerMessage,
                notebookId,
                questionContent: question,
                questionMessageId,
                selectedSourceIds: snapshot,
                status: aborted ? "aborted" : "failed",
                userId,
              },
              service,
            )
            send({ text: aborted ? abortedAnswerMessage : failedAnswerMessage, type: "error" })
          }
          finish()
        },
      })
      return new Response(stream, { headers: { "content-type": "text/event-stream" } })
    }
    if (!first || !source) throw new Error("Quelle konnte nicht zugeordnet werden.")
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
