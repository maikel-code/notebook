import type { SupabaseClient } from "@supabase/supabase-js"

import { MAX_CONTEXT_CHARS } from "@/lib/limits"
import { loadRetrievalCalibration } from "@/lib/rag/retrieval-config"

export interface RetrievalCandidate {
  chunkId: string
  content: string
  notebookId: string
  pageEnd: number
  pageStart: number
  similarity: number
  sourceId: string
  sourceName: string
  sourceSelected: boolean
  sourceStatus: "ready" | "processing" | "failed" | "unusable" | "uploading"
  userId: string
}

export class RetrievalFailure extends Error {}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) return 0
  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0
    const rightValue = right[index] ?? 0
    dot += leftValue * rightValue
    leftMagnitude += leftValue * leftValue
    rightMagnitude += rightValue * rightValue
  }
  return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : 0
}

export function retrieveSelectedReadyChunks(
  candidates: RetrievalCandidate[],
  options: { minimumSimilarity: number; notebookId: string; topK: number; userId: string },
): RetrievalCandidate[] {
  return candidates
    .filter(
      (candidate) =>
        candidate.userId === options.userId &&
        candidate.notebookId === options.notebookId &&
        candidate.sourceSelected &&
        candidate.sourceStatus === "ready" &&
        candidate.similarity >= options.minimumSimilarity,
    )
    .toSorted((left, right) => right.similarity - left.similarity)
    .slice(0, options.topK)
}

export function packRetrievalContext(candidates: RetrievalCandidate[]): string {
  let context = ""
  for (const [index, candidate] of candidates.entries()) {
    const prefix = `[${index + 1}] Quelle: ${candidate.sourceName}; Seiten: ${candidate.pageStart}-${candidate.pageEnd}\n`
    const remaining = MAX_CONTEXT_CHARS - context.length - prefix.length - 2
    if (remaining <= 0) break
    const block = `${prefix}${candidate.content.slice(0, remaining)}\n\n`
    context += block
  }
  return context
}

export async function loadSelectedReadyCandidates(
  service: SupabaseClient,
  notebookId: string,
  userId: string,
): Promise<RetrievalCandidate[]> {
  const { data, error } = await service
    .from("chunks")
    .select(
      "id, content, page_start, page_end, source_id, sources!inner(notebook_id, user_id, file_name, status, is_selected)",
    )
    .eq("user_id", userId)
    .eq("sources.notebook_id", notebookId)
    .eq("sources.user_id", userId)
    .eq("sources.status", "ready")
    .eq("sources.is_selected", true)
  if (error) throw new RetrievalFailure("Die Quellensuche ist fehlgeschlagen.")
  return (data ?? []).map((row) => {
    const source = row.sources as unknown as {
      file_name: string
      is_selected: boolean
      notebook_id: string
      status: RetrievalCandidate["sourceStatus"]
      user_id: string
    }
    return {
      chunkId: row.id,
      content: row.content,
      notebookId: source.notebook_id,
      pageEnd: row.page_end,
      pageStart: row.page_start,
      similarity: 0,
      sourceId: row.source_id,
      sourceName: source.file_name,
      sourceSelected: source.is_selected,
      sourceStatus: source.status,
      userId: source.user_id,
    }
  })
}

export async function retrieveForQuestion(
  service: SupabaseClient,
  notebookId: string,
  question: string,
  userId: string,
): Promise<RetrievalCandidate[]> {
  try {
    const calibration = await loadRetrievalCalibration()
    const { embedChunks } = await import("@/lib/ingestion/embed")
    const [questionEmbedding] = await embedChunks([question])
    if (!questionEmbedding) throw new RetrievalFailure("Die Frage konnte nicht durchsucht werden.")
    const candidates = await loadSelectedReadyCandidates(service, notebookId, userId)
    const { data, error } = await service
      .from("chunks")
      .select("id, embedding")
      .eq("user_id", userId)
      .in(
        "id",
        candidates.map((candidate) => candidate.chunkId),
      )
    if (error) throw new RetrievalFailure("Die Quellensuche ist fehlgeschlagen.")
    const embeddings = new Map(
      ((data ?? []) as unknown as Array<{ embedding: number[]; id: string }>).map((row) => [
        row.id,
        row.embedding,
      ]),
    )
    return retrieveSelectedReadyChunks(
      candidates.map((candidate) => ({
        ...candidate,
        similarity: cosineSimilarity(questionEmbedding, embeddings.get(candidate.chunkId) ?? []),
      })),
      { ...calibration, notebookId, userId },
    )
  } catch (error) {
    if (error instanceof RetrievalFailure) throw error
    throw new RetrievalFailure("Die Quellensuche ist fehlgeschlagen.")
  }
}
