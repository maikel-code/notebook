import "server-only"

import { createAnthropic } from "@ai-sdk/anthropic"
import { streamText } from "ai"

import { getServerEnvironment } from "@/lib/env"
import { type GeneratedAnswer, generatedAnswerSchema } from "@/lib/rag/claim-schema"
import { RAG_SYSTEM_PROMPT } from "@/lib/rag/prompt"

export async function generateAnswer(
  question: string,
  context: string,
  signal?: AbortSignal,
): Promise<GeneratedAnswer> {
  const anthropic = createAnthropic({ apiKey: getServerEnvironment().ANTHROPIC_API_KEY })
  const result = streamText({
    abortSignal: signal,
    model: anthropic("claude-sonnet-4-20250514"),
    prompt: `Frage:\n${question}\n\nQuellen:\n${context}`,
    system: RAG_SYSTEM_PROMPT,
  })
  let text = ""
  for await (const delta of result.textStream) text += delta
  return generatedAnswerSchema.parse(JSON.parse(text))
}
