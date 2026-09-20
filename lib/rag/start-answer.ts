import type { SupabaseClient } from "@supabase/supabase-js"

export async function startAnswerAttempt(
  service: SupabaseClient,
  input: {
    notebookId: string
    questionContent: string
    questionMessageId?: string
    selectedSourceIds: string[]
    userId: string
  },
): Promise<{ answerId: string; questionId: string }> {
  const database = service as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{
      data: Array<{ answer_id: string; question_id: string }> | null
      error: Error | null
    }>
  }
  const { data, error } = await database.rpc("start_answer_attempt", {
    p_notebook_id: input.notebookId,
    p_question_content: input.questionContent,
    p_question_message_id: input.questionMessageId ?? null,
    p_selected_sources_snapshot: input.selectedSourceIds,
    p_user_id: input.userId,
  })
  const attempt = data?.[0]
  if (error || !attempt) throw new Error("Die Antwort konnte nicht gestartet werden.")
  return { answerId: attempt.answer_id, questionId: attempt.question_id }
}
