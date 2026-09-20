import type { SupabaseClient } from "@supabase/supabase-js"

import { SOURCES_BUCKET } from "@/lib/ingestion/storage"

export async function cleanupStoragePath(
  service: SupabaseClient,
  sourceId: string,
  userId: string,
  storagePath: string | null,
): Promise<void> {
  if (!storagePath) return
  const { error } = await service.storage.from(SOURCES_BUCKET).remove([storagePath])
  if (error && !/not found/i.test(error.message)) {
    throw new Error("Die ersetzte Datei konnte nicht bereinigt werden.")
  }
  const { error: updateError } = await service
    .from("sources")
    .update({ cleanup_storage_path: null })
    .eq("id", sourceId)
    .eq("user_id", userId)
  if (updateError) throw new Error("Die Bereinigung konnte nicht abgeschlossen werden.")
}
