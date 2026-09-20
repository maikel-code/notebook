"use client"

import { useState, useTransition } from "react"

import { importWebSources } from "@/app/notebooks/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { WebSearchResult } from "@/lib/web/search"

interface SearchResponse {
  error?: string
  results?: WebSearchResult[]
}

export function SourceSearch({
  notebookId,
  onImported,
}: {
  notebookId: string
  onImported: () => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<WebSearchResult[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [preview, setPreview] = useState<WebSearchResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [searching, startSearch] = useTransition()
  const [importing, startImport] = useTransition()

  const runSearch = () => {
    setMessage(null)
    setPreview(null)
    setResults([])
    setSelected([])
    startSearch(async () => {
      const response = await fetch("/api/web/search", {
        body: JSON.stringify({ notebookId, query }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      const data = (await response.json()) as SearchResponse
      if (!response.ok) {
        setResults([])
        setSelected([])
        setMessage(data.error ?? "Die Websuche konnte nicht ausgeführt werden.")
        return
      }
      setResults(data.results ?? [])
      setSelected([])
      setMessage(data.results?.length ? null : "Keine öffentlichen Webseiten gefunden.")
    })
  }

  const toggle = (url: string) =>
    setSelected((current) =>
      current.includes(url)
        ? current.filter((selectedUrl) => selectedUrl !== url)
        : [...current, url],
    )
  const allSelected = results.length > 0 && selected.length === results.length
  const importSelected = () => {
    startImport(async () => {
      setMessage(null)
      try {
        const outcome = await importWebSources(notebookId, selected)
        const summary = outcome.outcomes
          .map(
            (item) =>
              `${item.url}: ${item.reason ?? (item.status === "started" ? "übernommen" : item.status)}`,
          )
          .join(" · ")
        setMessage(summary || "Keine Webseiten ausgewählt.")
        setSelected([])
        onImported()
      } catch {
        setMessage("Die ausgewählten Webseiten konnten nicht übernommen werden.")
      }
    })
  }

  return (
    <section aria-label="Webquellen suchen" className="grid gap-3 border-2 p-3">
      <h3 className="font-medium">Webquellen suchen</h3>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Webquellen durchsuchen"
          maxLength={200}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="button" disabled={searching || !query.trim()} onClick={runSearch}>
          {searching ? "Suche läuft" : "Suchen"}
        </Button>
      </div>
      {message ? <p role="status">{message}</p> : null}
      {results.length ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelected(allSelected ? [] : results.map((result) => result.url))}
            >
              {allSelected ? "Auswahl aufheben" : "Alle angezeigten auswählen"}
            </Button>
            <Button
              type="button"
              disabled={importing || selected.length === 0}
              onClick={importSelected}
            >
              {importing ? "Übernahme läuft" : "Auswahl bestätigen und übernehmen"}
            </Button>
          </div>
          <ul aria-label="Websuchergebnisse" className="grid gap-2">
            {results.map((result) => (
              <li key={result.url} className="grid gap-2 border p-2">
                <label className="flex gap-2">
                  <input
                    checked={selected.includes(result.url)}
                    type="checkbox"
                    onChange={() => toggle(result.url)}
                  />
                  <span>
                    <span className="font-medium">{result.title}</span> · {result.domain}
                  </span>
                </label>
                <p className="text-sm text-muted-foreground">{result.description}</p>
                <Button type="button" variant="outline" onClick={() => setPreview(result)}>
                  Vorschau anzeigen
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {preview ? (
        <section aria-label="Webquellenvorschau" className="grid gap-2 border p-2">
          <h4 className="font-medium">{preview.title}</h4>
          <p>{preview.description}</p>
          <p className="break-all text-sm">{preview.url}</p>
          <a className="underline" href={preview.url} rel="noreferrer" target="_blank">
            Originalwebseite öffnen
          </a>
        </section>
      ) : null}
    </section>
  )
}
