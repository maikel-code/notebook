import { createOpenAI } from "@ai-sdk/openai"
import { embedMany } from "ai"

import { getServerEnvironment } from "@/lib/env"

export async function embedChunks(values: string[]): Promise<number[][]> {
  if (values.length === 0) return []
  const openai = createOpenAI({ apiKey: getServerEnvironment().OPENAI_API_KEY })
  const result = await embedMany({ model: openai.embedding("text-embedding-3-small"), values })
  return result.embeddings
}
