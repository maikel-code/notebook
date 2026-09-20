"use client"

import { useEffect, useRef, useState } from "react"

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
  const closeButton = useRef<HTMLButtonElement>(null)
  const normalizedContent = content?.replaceAll(/\s+/g, " ").trim() ?? ""
  const normalizedQuote = quote.replaceAll(/\s+/g, " ").trim()
  const quoteIndex = normalizedContent.indexOf(normalizedQuote)
  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])
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
        className="mr-2 mt-1"
        size="xs"
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
                {normalizedContent.slice(0, quoteIndex)}
                <mark>{quote}</mark>
                {normalizedContent.slice(quoteIndex + normalizedQuote.length)}
              </p>
            ) : (
              <p>Wortlaut: {quote}</p>
            )}
            <Button ref={closeButton} type="button" onClick={() => setOpen(false)}>
              Schließen
            </Button>
          </div>
        </section>
      ) : null}
    </>
  )
}
