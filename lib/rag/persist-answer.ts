import type { SupabaseClient } from "@supabase/supabase-js"
import { invalidCitationMessage } from "@/lib/rag/unsupported"
import type { VerifiedCitation } from "@/lib/rag/verify-claims"

export interface PersistAnswerInput {
  answerMessageId?: string
  citations: VerifiedCitation[]
  content: string
  notebookId: string
  questionContent: string
  questionMessageId?: string
  selectedSourceIds?: string[]
  status?: "aborted" | "complete" | "failed" | "invalid"
  unsupportedReason?: "below_similarity_threshold" | "invalid_citations" | "unsupported"
  userId: string
}

export interface PersistedAnswer {
  displayLabel?: "ungeprüft und nicht belegt"
  id: string
  status: "aborted" | "complete" | "failed" | "invalid"
  unsupportedReason: "below_similarity_threshold" | "invalid_citations" | "unsupported" | null
}

export async function persistVerifiedAnswer(
  input: PersistAnswerInput,
  service: SupabaseClient,
): Promise<PersistedAnswer> {
  const status = input.status ?? "complete"
  const database = service as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{
      data: Array<{
        id: string
        status: "aborted" | "complete" | "failed" | "invalid"
        unsupported_reason:
          | "below_similarity_threshold"
          | "invalid_citations"
          | "unsupported"
          | null
      }> | null
      error: Error | null
    }>
  }
  const { data, error } = await database.rpc("persist_answer", {
    p_answer_content: input.content,
    p_answer_message_id: input.answerMessageId ?? null,
    p_answer_status: status,
    p_citations: input.citations.map((citation) => ({
      chunk_id: citation.chunkId,
      ordinal: citation.ordinal,
      page_end: citation.pageEnd,
      page_start: citation.pageStart,
      quote: citation.quote,
      source_id: citation.sourceId,
      source_name: citation.sourceName,
    })),
    p_notebook_id: input.notebookId,
    p_question_content: input.questionContent,
    p_question_message_id: input.questionMessageId ?? null,
    p_selected_sources_snapshot: input.selectedSourceIds ?? [],
    p_unsupported_reason: input.unsupportedReason ?? null,
    p_user_id: input.userId,
  })
  const answer = data?.[0]
  if (error || !answer) throw new Error("Die Antwort konnte nicht gespeichert werden.")
  return {
    ...(status === "invalid" ? { displayLabel: "ungeprüft und nicht belegt" as const } : {}),
    id: answer.id,
    status,
    unsupportedReason: answer.unsupported_reason,
  }
}

export { invalidCitationMessage }
