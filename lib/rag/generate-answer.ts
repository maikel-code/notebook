import "server-only"

import { createAnthropic } from "@ai-sdk/anthropic"
import { streamText } from "ai"

import { getServerEnvironment } from "@/lib/env"
import { claimSchema, type GeneratedAnswer, generatedAnswerSchema } from "@/lib/rag/claim-schema"
import { RAG_SYSTEM_PROMPT } from "@/lib/rag/prompt"

export async function generateAnswer(
  question: string,
  context: string,
  signal?: AbortSignal,
  onClaim?: (claim: {
    citations: Array<{ chunkNumber: number; quote: string }>
    text: string
  }) => void,
): Promise<GeneratedAnswer> {
  const anthropic = createAnthropic({ apiKey: getServerEnvironment().ANTHROPIC_API_KEY })
  const result = streamText({
    abortSignal: signal,
    model: anthropic("claude-sonnet-4-20250514"),
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
