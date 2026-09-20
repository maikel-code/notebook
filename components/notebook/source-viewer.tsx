"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { SOURCES_BUCKET, sourceStoragePath } from "@/lib/ingestion/storage"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"

export function SourceViewer({
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
  const [content, setContent] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const quoteIndex = content?.indexOf(quote) ?? -1
  const openSource = async () => {
    try {
      const client = createBrowserSupabaseClient()
      const { data: user } = await client.auth.getUser()
      if (!user.user) return
      const { data } = await client.storage
        .from(SOURCES_BUCKET)
        .download(sourceStoragePath(user.user.id, notebookId, sourceId))
      if (!data) return
      const { GlobalWorkerOptions, getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
      GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url,
      ).toString()
      const document = await getDocument({ data: new Uint8Array(await data.arrayBuffer()) }).promise
      const page = await document.getPage(pageStart)
      const text = (await page.getTextContent()).items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
      setContent(text)
    } catch {
      setContent(quote)
    }
    setOpen(true)
  }
  return (
    <>
      <Button
        aria-label={`Quelle: ${sourceName}, Seite ${pageStart}`}
        type="button"
        variant="outline"
        onClick={openSource}
      >
        {sourceName}, Seite {pageStart}
      </Button>
      {open ? (
        <section
          aria-label="Quelle anzeigen"
          aria-modal="true"
          className="fixed inset-0 grid place-items-center bg-black/50 p-4"
          role="dialog"
        >
          <div className="grid max-w-xl gap-3 bg-card p-5">
            <h2 className="font-head">Quelle anzeigen</h2>
            <p>Seite {pageStart}</p>
            {content && quoteIndex >= 0 ? (
              <p>
                {content.slice(0, quoteIndex)}
                <mark>{quote}</mark>
                {content.slice(quoteIndex + quote.length)}
              </p>
            ) : (
              <p>Wortlaut: {quote}</p>
            )}
            <Button type="button" onClick={() => setOpen(false)}>
              Schließen
            </Button>
          </div>
        </section>
      ) : null}
    </>
  )
}
