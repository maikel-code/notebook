import { NextResponse } from "next/server"

import { getServerEnvironment } from "@/lib/env"
import { hasValidJobSecret } from "@/lib/ingestion/job-secret"
import { sweepIngestionJobs } from "@/lib/ingestion/run-job"
import { createServiceSupabaseClient } from "@/lib/supabase/service"

export async function POST(request: Request) {
  if (
    !hasValidJobSecret(
      request.headers.get("x-job-trigger-secret"),
      getServerEnvironment().JOB_TRIGGER_SECRET,
    )
  ) {
    return NextResponse.json({ error: "Unautorisierter Aufruf." }, { status: 401 })
  }
  const swept = await sweepIngestionJobs(createServiceSupabaseClient())
  return NextResponse.json({ swept })
}
