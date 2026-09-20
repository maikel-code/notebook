import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth/authorize"
import { HttpError } from "@/lib/http/errors"
import { listJobStatusForContext } from "@/lib/ingestion/status"
import { createServiceSupabaseClient } from "@/lib/supabase/service"

export async function GET(request: Request) {
  try {
    const notebookId = new URL(request.url).searchParams.get("notebookId")
    if (!notebookId) return NextResponse.json({ error: "Notebook fehlt." }, { status: 422 })
    const { userId } = await requireUser()
    const sources = await listJobStatusForContext(
      { userId },
      notebookId,
      createServiceSupabaseClient(),
    )
    return NextResponse.json({ sources })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: "Status konnte nicht geladen werden." }, { status: 500 })
  }
}
