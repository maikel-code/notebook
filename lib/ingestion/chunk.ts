import type { ExtractedPage } from "@/lib/ingestion/extract"

export interface IngestionChunk {
  charCount: number
  content: string
  ordinal: number
  pageEnd: number
  pageStart: number
}

const MAX_CHUNK_CHARS = 1_200

export function chunkExtractedPages(pages: ExtractedPage[]): IngestionChunk[] {
  const chunks: IngestionChunk[] = []
  for (const { page, text } of pages) {
    const normalized = text.replaceAll(/\s+/g, " ").trim()
    for (let offset = 0; offset < normalized.length; offset += MAX_CHUNK_CHARS) {
      const content = normalized.slice(offset, offset + MAX_CHUNK_CHARS).trim()
      if (!content) continue
      chunks.push({
        charCount: content.length,
        content,
        ordinal: chunks.length,
        pageEnd: page,
        pageStart: page,
      })
    }
  }
  return chunks
}
