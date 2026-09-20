import type { SupabaseClient } from "@supabase/supabase-js"

import type { RequestContext } from "@/lib/auth/ownership"
import { unauthorizedError } from "@/lib/http/errors"
import { getNotebookForContext } from "@/lib/notebooks/service"

export interface SourceJobStatus {
  errorReason: string | null
  id: string
  phase: string | null
  status: string
}

export async function listJobStatusForContext(
  context: RequestContext | null,
  notebookId: string,
  service: SupabaseClient,
): Promise<SourceJobStatus[]> {
  if (!context) throw unauthorizedError()
  await getNotebookForContext(context, notebookId, service)
  const { data, error } = await service
    .from("sources")
    .select("id, status, error_reason, ingestion_jobs(phase, status, created_at)")
    .eq("notebook_id", notebookId)
    .eq("user_id", context.userId)
    .order("created_at", { ascending: true })
  if (error) throw new Error("Quellenstatus konnte nicht geladen werden.")
  return (data ?? []).map((source) => {
    const jobs = (source.ingestion_jobs ?? []) as Array<{
      created_at: string
      phase: string | null
      status: string
    }>
    const job = jobs.toSorted((left, right) => right.created_at.localeCompare(left.created_at))[0]
    return {
      errorReason: source.error_reason,
      id: source.id,
      phase: job?.phase ?? null,
      status: source.status,
    }
  })
}
