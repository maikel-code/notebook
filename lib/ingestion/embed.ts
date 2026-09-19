import { createOpenAI } from "@ai-sdk/openai"
import { embedMany } from "ai"

import { getServerEnvironment } from "@/lib/env"
import { localE2EEmbeddings } from "@/lib/ingestion/local-e2e"

export async function embedChunks(values: string[]): Promise<number[][]> {
  if (values.length === 0) return []
  const fixtureEmbeddings = await localE2EEmbeddings(values)
  if (fixtureEmbeddings) return fixtureEmbeddings
  const openai = createOpenAI({ apiKey: getServerEnvironment().OPENAI_API_KEY })
  const result = await embedMany({ model: openai.embedding("text-embedding-3-small"), values })
  return result.embeddings
}
