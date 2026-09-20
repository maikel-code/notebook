import { SourceViewer } from "@/components/notebook/source-viewer"

export function CitationChip({
  notebookId,
  originUrl,
  pageStart,
  quote,
  sourceId,
  sourceKind,
  sourceName,
}: {
  notebookId: string
  originUrl?: string | null
  pageStart: number
  quote: string
  sourceId: string | null
  sourceKind?: "pdf" | "web" | null
  sourceName: string
}) {
  if (!sourceId) {
    return <span>Quelle entfernt · Wortlaut vorhanden</span>
  }
  if (sourceKind === "web" && originUrl) {
    return (
      <a
        aria-label={`Originalwebseite: ${sourceName}, Abschnitt ${pageStart}`}
        className="inline-flex border-2 px-3 py-2 underline"
        href={originUrl}
        rel="noreferrer"
        target="_blank"
      >
        {sourceName}, Originalwebseite
      </a>
    )
  }
  return (
    <SourceViewer
      notebookId={notebookId}
      pageStart={pageStart}
      quote={quote}
      sourceId={sourceId}
      sourceName={sourceName}
    />
  )
}
