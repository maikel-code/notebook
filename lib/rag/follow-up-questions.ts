import "server-only"

import { generateObject } from "ai"
import { z } from "zod"
import {
  fallbackFollowUpQuestions,
  normalizeFollowUpQuestions,
} from "@/lib/rag/follow-up-question-shape"
import { getChatModel } from "@/lib/rag/generate-answer"

const followUpQuestionSchema = z.array(z.string().trim().min(1)).min(3).max(5)

export async function generateFollowUpQuestions(input: {
  answer: string
  context: string
  question: string
}): Promise<string[]> {
  try {
    const result = await generateObject({
      model: getChatModel(),
      prompt: `Letzte Nutzerfrage:\n${input.question}\n\nBelegte Antwort:\n${input.answer}\n\nQuellenblöcke:\n${input.context}`,
      schema: followUpQuestionSchema,
      system:
        "Erzeuge drei bis fünf kurze, konkrete Anschlussfragen auf Deutsch. Sie müssen sich direkt auf die belegte Antwort und die vorliegenden Quellen beziehen. Frage nach konkreten Details, Fristen, Bedingungen, Ausnahmen oder nächsten Prüfschritten. Erfinde keine Fakten und gib nur die Fragen zurück.",
    })
    return normalizeFollowUpQuestions(result.object) ?? fallbackFollowUpQuestions()
  } catch {
    return fallbackFollowUpQuestions()
  }
}

export { fallbackFollowUpQuestions, normalizeFollowUpQuestions }
