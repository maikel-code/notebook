import { conflictError } from "@/lib/http/errors"
import { abortedAnswerMessage, failedAnswerMessage } from "@/lib/rag/unsupported"

interface ChatAttemptInput {
  answerProvider?: Error
  failures?: { answerProvider?: Error; questionEmbedding?: Error; retrieval?: Error }
  questionEmbedding?: Error
  retrieval?: Error
  signal?: AbortSignal
  whileStreaming?: "delete-notebook" | "delete-source" | "question"
}

export async function runChatAttempt(input: ChatAttemptInput) {
  if (input.whileStreaming)
    throw conflictError("Die laufende Antwort muss zuerst beendet oder abgebrochen werden.")
  if (input.signal?.aborted)
    return { citations: [], content: abortedAnswerMessage, status: "aborted" as const }
  const failures = input.failures ?? input
  if (failures.answerProvider || failures.questionEmbedding || failures.retrieval) {
    return { citations: [], content: failedAnswerMessage, status: "failed" as const }
  }
  return { citations: [], content: "", status: "complete" as const }
}
