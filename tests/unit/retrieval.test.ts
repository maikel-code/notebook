import { describe, expect, it } from "vitest"

import { MAX_CONTEXT_CHARS } from "@/lib/limits"
import {
  packRetrievalContext,
  type RetrievalCandidate,
  retrieveSelectedReadyChunks,
} from "@/lib/rag/retrieve"

const threshold = 0.72

function candidate(index: number, similarity: number, overrides: Partial<RetrievalCandidate> = {}) {
  return {
    chunkId: `chunk-${index}`,
    content: `Abschnitt ${index}`,
    notebookId: "notebook-a",
    pageEnd: 1,
    pageStart: 1,
    similarity,
    sourceId: `source-${index}`,
    sourceName: `Quelle ${index}`,
    sourceSelected: true,
    sourceStatus: "ready" as const,
    userId: "owner-a",
    ...overrides,
  }
}

describe("retrieval", () => {
  it("uses only the owner's selected ready sources, keeps top eight, and accepts the threshold inclusively", () => {
    const candidates = [
      ...Array.from({ length: 9 }, (_, index) => candidate(index + 1, 0.99 - index / 100)),
      candidate(10, threshold),
      candidate(11, threshold - 0.001),
      candidate(12, 0.99, { sourceSelected: false }),
      candidate(13, 0.99, { sourceStatus: "processing" }),
      candidate(14, 0.99, { userId: "stranger" }),
      candidate(15, 0.99, { notebookId: "notebook-b" }),
    ]

    const matches = retrieveSelectedReadyChunks(candidates, {
      minimumSimilarity: threshold,
      notebookId: "notebook-a",
      topK: 8,
      userId: "owner-a",
    })

    expect(matches).toHaveLength(8)
    expect(matches.map((match) => match.chunkId)).toEqual([
      "chunk-1",
      "chunk-2",
      "chunk-3",
      "chunk-4",
      "chunk-5",
      "chunk-6",
      "chunk-7",
      "chunk-8",
    ])
    expect(matches.every((match) => match.similarity >= threshold)).toBe(true)
    expect(matches.map((match) => match.sourceId)).not.toContain("source-12")
  })

  it("packs ranked chunks without ever exceeding the context character limit", () => {
    const first = candidate(1, 0.9, { content: "a".repeat(MAX_CONTEXT_CHARS - 10) })
    const second = candidate(2, 0.8, { content: "b".repeat(20) })

    const context = packRetrievalContext([first, second])

    expect(context).toContain("[1]")
    expect(context).not.toContain("[2]")
    expect(context.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS)
  })
})
