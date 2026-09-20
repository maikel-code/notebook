"use client"

import { useRouter } from "next/navigation"
import { useCallback, useTransition } from "react"

import { retryIngestion } from "@/app/notebooks/actions"
import { useJobStatus } from "@/components/notebook/use-job-status"
import { Button } from "@/components/ui/button"
import {Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle} from "@/components/ui/item";

export interface NotebookSource {
  errorReason: string | null
  fileName: string
  id: string
  sourceKind: "pdf" | "web"
  status: "failed" | "processing" | "ready" | "unusable" | "uploading"
}

function sourceStatus(status: string): string {
  if (status === "uploading" || status === "processing") return "wird verarbeitet"
  if (status === "ready") return "bereit"
  if (status === "failed") return "fehlgeschlagen"
  return "nicht nutzbar"
}

export function SourceList({
  onSelect,
  notebookId,
  selectedSourceId,
  sources,
}: {
  notebookId: string
  onSelect?: (sourceId: string) => void
  selectedSourceId?: string | null
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
    <ItemGroup className="grid gap-3" aria-label="Quellen">
      {sources.map((source) => (
        <Item variant="outline"
          key={source.id}
          className=" bg-background"
        >
          <ItemContent>
            <ItemTitle className="font-medium">{source.fileName}</ItemTitle>
            <ItemDescription aria-live="polite" className="text-sm text-muted-foreground">
              {source.sourceKind === "web" ? "Webquelle" : "PDF"} · {sourceStatus(source.status)}
              {source.errorReason ? `: ${source.errorReason}` : ""}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            {onSelect ? (
              <Button
                aria-current={selectedSourceId === source.id ? "page" : undefined}
                type="button"
                size="xs"
                variant="outline"
                onClick={() => onSelect(source.id)}
              >
                Quelle lesen
              </Button>
            ) : null}
            {source.status === "failed" ? (
              <Button
                type="button"
                size="xs"
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
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}
