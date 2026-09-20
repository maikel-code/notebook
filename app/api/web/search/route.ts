import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth/authorize"
import { HttpError } from "@/lib/http/errors"
import { createServiceSupabaseClient } from "@/lib/supabase/service"
import { searchWebSourcesForContext } from "@/lib/web/search"

export async function POST(request: Request): Promise<Response> {
  try {
    const input = (await request.json()) as { notebookId?: string; query?: string }
    const { userId } = await requireUser()
    const results = await searchWebSourcesForContext(
      { userId },
      { notebookId: input.notebookId ?? "", query: input.query ?? "" },
      createServiceSupabaseClient(),
    )
    return NextResponse.json({ results })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { error: "Die Websuche konnte nicht ausgeführt werden." },
      { status: 502 },
    )
  }
}
