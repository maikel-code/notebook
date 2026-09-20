import { MAX_ORIENTATION_QUESTIONS, MIN_ORIENTATION_QUESTIONS } from "@/lib/limits"

export function normalizeFollowUpQuestions(questions: string[]): string[] | null {
  const normalized = [
    ...new Map(
      questions
        .map((question) => question.replaceAll(/\s+/g, " ").trim())
        .map((question) => [question.toLocaleLowerCase("de-DE"), question]),
    ).values(),
  ]
  if (
    normalized.length < MIN_ORIENTATION_QUESTIONS ||
    normalized.length > MAX_ORIENTATION_QUESTIONS ||
    normalized.some((question) => !question)
  ) {
    return null
  }
  return normalized
}

export function fallbackFollowUpQuestions(): string[] {
  return [
    "Welche weiteren Details nennt die Quelle zu diesem Thema?",
    "Welche Frist, Voraussetzung oder Ausnahme sollte ich dazu prüfen?",
    "Welche Aussage lässt sich anhand der Quelle als Nächstes vertiefen?",
  ]
}
