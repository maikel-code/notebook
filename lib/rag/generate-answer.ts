import "server-only"

import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { type LanguageModel, streamText } from "ai"

import { getServerEnvironment } from "@/lib/env"
import { resolveChatModelConfig } from "@/lib/rag/chat-provider"
import { claimSchema, type GeneratedAnswer, generatedAnswerSchema } from "@/lib/rag/claim-schema"
import { RAG_SYSTEM_PROMPT } from "@/lib/rag/prompt"

export function getChatModel(): LanguageModel {
  const config = resolveChatModelConfig(getServerEnvironment())
  if (config.provider === "openai") {
    const openai = createOpenAI({ apiKey: config.apiKey })
    return openai(config.model)
  }
  const anthropic = createAnthropic({ apiKey: config.apiKey })
  return anthropic(config.model)
}

export async function generateAnswer(
  question: string,
  context: string,
  signal?: AbortSignal,
  onClaim?: (claim: {
    citations: Array<{ chunkNumber: number; quote: string }>
    text: string
  }) => void,
): Promise<GeneratedAnswer> {
  const result = streamText({
    abortSignal: signal,
    model: getChatModel(),
    prompt: `Frage:\n${question}\n\nQuellen:\n${context}`,
    system: RAG_SYSTEM_PROMPT,
  })
  const claims: Array<{ citations: Array<{ chunkNumber: number; quote: string }>; text: string }> =
    []
  let buffered = ""
  for await (const delta of result.textStream) {
    buffered += delta
    let newline = buffered.indexOf("\n")
    while (newline >= 0) {
      const line = buffered.slice(0, newline).trim()
      buffered = buffered.slice(newline + 1)
      if (line) {
        const event = JSON.parse(line) as { kind?: string }
        if (event.kind === "unsupported")
          return generatedAnswerSchema.parse({ kind: "unsupported" })
        const { kind: _kind, ...claimEvent } = event
        const claim = claimSchema.parse(claimEvent)
        claims.push(claim)
        onClaim?.(claim)
      }
      newline = buffered.indexOf("\n")
    }
  }
  if (buffered.trim()) {
    const event = JSON.parse(buffered) as { kind?: string }
    if (event.kind === "unsupported") return generatedAnswerSchema.parse({ kind: "unsupported" })
    const { kind: _kind, ...claimEvent } = event
    const claim = claimSchema.parse(claimEvent)
    claims.push(claim)
    onClaim?.(claim)
  }
  return generatedAnswerSchema.parse({ claims, kind: "answer" })
}
