import { notFoundError, validationError } from "@/lib/http/errors"

interface Attempt {
  attemptNo?: number
  id?: string
  ownerId?: string
  status: string
}
interface RetryInput {
  attempts?: Attempt[]
  messageId?: string
  target?: Attempt | null
  userId: string
}

export async function retryFailedAnswer(input: RetryInput) {
  const target = input.target ?? input.attempts?.find((attempt) => attempt.id === input.messageId)
  if (!target || (target.ownerId && target.ownerId !== input.userId)) throw notFoundError()
  if (target.status !== "failed")
    throw validationError("Nur fehlgeschlagene Antworten können erneut versucht werden.")
  const attemptNo =
    Math.max(...(input.attempts ?? [target]).map((attempt) => attempt.attemptNo ?? 1)) + 1
  return { attemptNo, questionReused: true, status: "streaming" as const }
}
