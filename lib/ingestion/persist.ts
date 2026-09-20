import type { SupabaseClient } from "@supabase/supabase-js"

import type { IngestionChunk } from "@/lib/ingestion/chunk"

export interface EmbeddedChunk extends IngestionChunk {
  embedding: number[]
}

export async function persistFetchedWebSource(
  service: SupabaseClient,
  sourceId: string,
  userId: string,
  source: { byteSize: number; canonicalUrl: string; contentHash: string; fileName: string },
): Promise<void> {
  const { error } = await service
    .from("sources")
    .update({
      byte_size: source.byteSize,
      canonical_url: source.canonicalUrl,
      content_hash: source.contentHash,
      file_name: source.fileName,
    })
    .eq("id", sourceId)
    .eq("source_kind", "web")
    .eq("user_id", userId)
  if (error) throw new Error("Die Webquellenfassung konnte nicht gespeichert werden.")
}

export async function replaceChunksForSource(
  service: SupabaseClient,
  sourceId: string,
  userId: string,
  chunks: EmbeddedChunk[],
): Promise<void> {
  const { error } = await service.rpc("replace_source_chunks", {
    p_chunks: chunks.map((chunk) => ({
      char_count: chunk.charCount,
      content: chunk.content,
      embedding: chunk.embedding,
      ordinal: chunk.ordinal,
      page_end: chunk.pageEnd,
      page_start: chunk.pageStart,
    })),
    p_source_id: sourceId,
    p_user_id: userId,
  })
  if (error) throw new Error("Textabschnitte konnten nicht gespeichert werden.")
}
