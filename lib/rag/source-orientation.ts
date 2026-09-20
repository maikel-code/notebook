import type { SupabaseClient } from "@supabase/supabase-js"

import { MAX_ORIENTATION_QUESTIONS, MIN_ORIENTATION_QUESTIONS } from "@/lib/limits"
import type { GeneratedAnswer } from "@/lib/rag/claim-schema"
import { buildUntrustedContext } from "@/lib/rag/context"
import type { RetrievedCitationChunk, VerifiedCitation } from "@/lib/rag/verify-claims"
import { verifyClaims } from "@/lib/rag/verify-claims"

export const SOURCE_ORIENTATION_PROMPT =
  "Gib einen kurzen ersten Überblick über diese Quelle. Nenne nur belegte Aussagen und keine Einleitung."

export type SourceOrientationGenerator = (input: {
  context: string
  sourceName: string
}) => Promise<GeneratedAnswer>

type OrientationVerification =
  | {
      citations: VerifiedCitation[]
      content: string
      kind: "valid"
      suggestedQuestions: string[]
    }
  | { kind: "invalid"; reason: "invalid_citations" | "invalid_questions" }

type OrientationResult =
  | { id: string; kind: "created"; sourceId: string }
  | {
      kind: "skipped"
      reason:
        | "already_oriented"
        | "history_exists"
        | "invalid_citations"
        | "invalid_questions"
        | "no_chunks"
        | "not_first_ready_source"
        | "source_not_ready"
    }

interface OrientationSourceRow {
  file_name: string
  status: string
}

interface OrientationChunkRow {
  content: string
  id: string
  page_end: number
  page_start: number
}

function normalizeQuestion(question: string): string {
  return question.replaceAll(/\s+/g, " ").trim()
}

function validQuestions(questions: string[]): boolean {
  return (
    questions.length >= MIN_ORIENTATION_QUESTIONS &&
    questions.length <= MAX_ORIENTATION_QUESTIONS &&
    questions.every((question) => normalizeQuestion(question).length > 0) &&
    new Set(questions.map((question) => normalizeQuestion(question).toLocaleLowerCase("de-DE")))
      .size === questions.length
  )
}

export function createStarterQuestions(_sourceName: string): string[] {
  return [
    "Welche zentralen Punkte nennt diese Quelle?",
    "Welche Schritte, Fristen oder Voraussetzungen sind beschrieben?",
    "Welche Begriffe sollte ich aus dieser Quelle genauer prüfen?",
  ]
}

export function verifySourceOrientation(
  generated: unknown,
  _sourceName: string,
  suggestedQuestions: string[],
  chunks: RetrievedCitationChunk[],
): OrientationVerification {
  if (!validQuestions(suggestedQuestions)) return { kind: "invalid", reason: "invalid_questions" }

  const verification = verifyClaims(generated, chunks)
  if (verification.kind === "invalid") return verification

  return {
    citations: verification.citations,
    content: verification.claims.join("\n\n"),
    kind: "valid",
    suggestedQuestions: suggestedQuestions.map(normalizeQuestion),
  }
}

async function defaultGenerator(input: {
  context: string
  sourceName: string
}): Promise<GeneratedAnswer> {
  const { generateAnswer } = await import("@/lib/rag/generate-answer")
  return generateAnswer(`${SOURCE_ORIENTATION_PROMPT}\nQuelle: ${input.sourceName}`, input.context)
}

async function persistSourceOrientation(
  service: SupabaseClient,
  input: {
    citations: VerifiedCitation[]
    content: string
    notebookId: string
    sourceId: string
    suggestedQuestions: string[]
    userId: string
  },
): Promise<{ id: string } | null> {
  const { data: message, error: messageError } = await service
    .from("messages")
    .insert({
      content: input.content,
      message_kind: "source_orientation",
      notebook_id: input.notebookId,
      orientation_source_id: input.sourceId,
      role: "assistant",
      status: "complete",
      suggested_questions: input.suggestedQuestions,
      user_id: input.userId,
    })
    .select("id")
    .maybeSingle()
  if (messageError?.code === "23505") return null
  if (messageError || !message)
    throw new Error("Die Quellenorientierung konnte nicht gespeichert werden.")

  const { error: citationError } = await service.from("citations").insert(
    input.citations.map((citation) => ({
      chunk_id: citation.chunkId,
      message_id: message.id,
      ordinal: citation.ordinal,
      page_end: citation.pageEnd,
      page_start: citation.pageStart,
      quote: citation.quote,
      source_id: citation.sourceId,
      source_name: citation.sourceName,
      user_id: input.userId,
    })),
  )
  if (!citationError) return { id: message.id }

  await service.from("messages").delete().eq("id", message.id).eq("user_id", input.userId)
  throw new Error("Die Quellenorientierung konnte nicht mit Belegen gespeichert werden.")
}

export async function createSourceOrientationIfEligible(input: {
  generate?: SourceOrientationGenerator
  notebookId: string
  service: SupabaseClient
  sourceId: string
  userId: string
}): Promise<OrientationResult> {
  const { data: source, error: sourceError } = await input.service
    .from("sources")
    .select("file_name, status")
    .eq("id", input.sourceId)
    .eq("notebook_id", input.notebookId)
    .eq("user_id", input.userId)
    .maybeSingle()
  if (sourceError || !source || (source as OrientationSourceRow).status !== "ready") {
    return { kind: "skipped", reason: "source_not_ready" }
  }
  const sourceRow = source as OrientationSourceRow

  const [
    { data: history, error: historyError },
    { count: readySourceCount, error: readySourceError },
  ] = await Promise.all([
    input.service
      .from("messages")
      .select("id")
      .eq("notebook_id", input.notebookId)
      .eq("user_id", input.userId)
      .limit(1),
    input.service
      .from("sources")
      .select("id", { count: "exact", head: true })
      .eq("notebook_id", input.notebookId)
      .eq("user_id", input.userId)
      .eq("status", "ready"),
  ])
  if (historyError || readySourceError)
    throw new Error("Die Orientierung konnte nicht vorbereitet werden.")
  if (history?.length) {
    return {
      kind: "skipped",
      reason: history.some((message) => message.id) ? "history_exists" : "already_oriented",
    }
  }
  if ((readySourceCount ?? 0) !== 1) return { kind: "skipped", reason: "not_first_ready_source" }

  const { data: chunkRows, error: chunkError } = await input.service
    .from("chunks")
    .select("id, content, page_start, page_end")
    .eq("source_id", input.sourceId)
    .eq("user_id", input.userId)
    .order("ordinal", { ascending: true })
  if (chunkError) throw new Error("Die Quellenorientierung konnte nicht vorbereitet werden.")
  const chunks = ((chunkRows ?? []) as OrientationChunkRow[]).map((chunk, index) => ({
    chunkId: chunk.id,
    chunkNumber: index + 1,
    content: chunk.content,
    pageEnd: chunk.page_end,
    pageStart: chunk.page_start,
    sourceId: input.sourceId,
    sourceName: sourceRow.file_name,
  }))
  if (!chunks.length) return { kind: "skipped", reason: "no_chunks" }
  const firstChunk = chunks[0]
  if (!firstChunk) return { kind: "skipped", reason: "no_chunks" }

  const localE2EGenerator: SourceOrientationGenerator = async () => ({
    claims: [
      {
        citations: [{ chunkNumber: 1, quote: firstChunk.content }],
        text: firstChunk.content,
      },
    ],
    kind: "answer",
  })
  const generator =
    input.generate ??
    (process.env.NOTEBOOK_E2E_INGESTION_MODE === "1" ? localE2EGenerator : defaultGenerator)
  const generated = await generator({
    context: buildUntrustedContext(
      chunks.map((chunk) => ({
        ...chunk,
        notebookId: input.notebookId,
        similarity: 1,
        sourceSelected: true,
        sourceStatus: "ready" as const,
        userId: input.userId,
      })),
    ),
    sourceName: sourceRow.file_name,
  })
  const verification = verifySourceOrientation(
    generated,
    sourceRow.file_name,
    createStarterQuestions(sourceRow.file_name),
    chunks,
  )
  if (verification.kind === "invalid") return { kind: "skipped", reason: verification.reason }

  const persisted = await persistSourceOrientation(input.service, {
    citations: verification.citations,
    content: verification.content,
    notebookId: input.notebookId,
    sourceId: input.sourceId,
    suggestedQuestions: verification.suggestedQuestions,
    userId: input.userId,
  })
  if (!persisted) return { kind: "skipped", reason: "already_oriented" }
  return { id: persisted.id, kind: "created", sourceId: input.sourceId }
}
