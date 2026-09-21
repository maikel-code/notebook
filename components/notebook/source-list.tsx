"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState, useTransition } from "react"

import { retryIngestion, setSourceSelected } from "@/app/notebooks/actions"
import { useJobStatus } from "@/components/notebook/use-job-status"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { MAX_SELECTED_SOURCES } from "@/lib/limits"

export interface NotebookSource {
  errorReason: string | null
  fileName: string
  id: string
  isSelected: boolean
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
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [selections, setSelections] = useState(
    () => new Map(sources.map((source) => [source.id, source.isSelected])),
  )
  useEffect(() => {
    setSelections(new Map(sources.map((source) => [source.id, source.isSelected])))
  }, [sources])
  const refresh = useCallback(() => router.refresh(), [router])
  useJobStatus(
    notebookId,
    sources.map((source) => source.status),
    refresh,
  )

  if (sources.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Quellen aufgenommen.</p>
  }

  const selectedCount = sources.filter(
    (source) => source.status === "ready" && selections.get(source.id),
  ).length

  const updateSelection = (source: NotebookSource, checked: boolean) => {
    const previous = selections.get(source.id) ?? false
    if (checked && !previous && selectedCount >= MAX_SELECTED_SOURCES) {
      setSelectionError(`Es dürfen höchstens ${MAX_SELECTED_SOURCES} Quellen ausgewählt sein.`)
      return
    }
    setSelectionError(null)
    setSelections((current) => new Map(current).set(source.id, checked))
    startTransition(async () => {
      try {
        await setSourceSelected(source.id, checked)
        refresh()
      } catch {
        setSelections((current) => new Map(current).set(source.id, previous))
        setSelectionError("Die Quellenauswahl konnte nicht gespeichert werden.")
      }
    })
  }

  return (
    <ItemGroup className="grid gap-3" aria-label="Quellen">
      <p className="text-sm text-muted-foreground">
        {selectedCount} / {MAX_SELECTED_SOURCES} Quellen für Fragen ausgewählt
      </p>
      {selectionError ? (
        <p className="text-sm text-destructive" role="alert">
          {selectionError}
        </p>
      ) : null}
      {sources.map((source) => (
        <Item variant="outline" key={source.id} className="bg-background">
          <ItemContent>
            <ItemTitle className="font-medium">{source.fileName}</ItemTitle>
            <ItemDescription aria-live="polite" className="text-sm text-muted-foreground">
              {source.sourceKind === "web" ? "Webquelle" : "PDF"} · {sourceStatus(source.status)}
              {source.errorReason ? `: ${source.errorReason}` : ""}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Checkbox
              aria-label={`${source.fileName} für Fragen verwenden`}
              checked={selections.get(source.id) ?? false}
              disabled={pending || source.status !== "ready"}
              onCheckedChange={(checked) => updateSelection(source, checked === true)}
            />
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
