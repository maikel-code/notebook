"use client"

import { useRouter } from "next/navigation"
import { useCallback, useTransition } from "react"

import { retryIngestion } from "@/app/notebooks/actions"
import { useJobStatus } from "@/components/notebook/use-job-status"
import { Button } from "@/components/ui/button"

export interface NotebookSource {
  errorReason: string | null
  fileName: string
  id: string
  status: "failed" | "processing" | "ready" | "unusable" | "uploading"
}

function sourceStatus(status: NotebookSource["status"]): string {
  if (status === "uploading" || status === "processing") return "wird verarbeitet"
  if (status === "ready") return "bereit"
  if (status === "failed") return "fehlgeschlagen"
  return "nicht nutzbar"
}

export function SourceList({
  notebookId,
  sources,
}: {
  notebookId: string
  sources: NotebookSource[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const refresh = useCallback(() => router.refresh(), [router])
  useJobStatus(
    notebookId,
    sources.map((source) => source.status),
    refresh,
  )

  if (sources.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Quellen aufgenommen.</p>
  }

  return (
    <ul className="grid gap-3" aria-label="Quellen">
      {sources.map((source) => (
        <li
          key={source.id}
          className="flex flex-wrap items-center justify-between gap-3 border-2 p-3"
        >
          <div>
            <p className="font-medium">{source.fileName}</p>
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {sourceStatus(source.status)}
              {source.errorReason ? `: ${source.errorReason}` : ""}
            </p>
          </div>
          {source.status === "failed" ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await retryIngestion(source.id)
                  refresh()
                })
              }
            >
              Erneut versuchen
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
