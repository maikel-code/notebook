import { SourceViewer } from "@/components/notebook/source-viewer"

export function CitationChip({
  notebookId,
  pageStart,
  quote,
  sourceId,
  sourceName,
}: {
  notebookId: string
  pageStart: number
  quote: string
  sourceId: string
  sourceName: string
}) {
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
