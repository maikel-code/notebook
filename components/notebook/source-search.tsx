"use client"

import {ExternalLink, Search} from "lucide-react"
import { useId, useState, useTransition } from "react"
import { importWebSources } from "@/app/notebooks/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import type { WebSearchResult } from "@/lib/web/search"
import {Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle} from "@/components/ui/item";
import {Label} from "@/components/ui/label";
import {InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput} from "@/components/ui/input-group";

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
  const [message, setMessage] = useState<string | null>(null)
  const [searching, startSearch] = useTransition()
  const [importing, startImport] = useTransition()
  const checkboxIdPrefix = useId()

  const runSearch = () => {
    setMessage(null)
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
    <section aria-label="Webquellen suchen" className="grid gap-2  ">
        <Label className="font-medium" htmlFor="webquellen">Webquellen suchen</Label>
      <InputGroup className="py-4">
        <InputGroupInput id="webquellen" placeholder="Suchbegriff eingeben..."   aria-label="Webquellen durchsuchen"
          maxLength={200}
          value={query}
          onKeyDown={(event) => { if (event.key === "Enter") runSearch()}}
          onChange={(event) => setQuery(event.target.value)} />
        <InputGroupAddon align="inline-end">
          <InputGroupButton variant="secondary" disabled={searching} onClick={runSearch}>
          {searching ? "Suche läuft" : "Suchen"}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {message ? <p role="status">{message}</p> : null}
      {results.length ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSelected(allSelected ? [] : results.map((result) => result.url))}
            >
              {allSelected ? "Auswahl aufheben" : "Alle auswählen"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={importing || selected.length === 0}
              onClick={importSelected}
            >
              {importing ? "Übernahme läuft" : "Auswahl bestätigen und übernehmen"}
            </Button>
          </div>
          <ItemGroup aria-label="Websuchergebnisse" className="grid gap-2">
            {results.map((result) => (
              <Item className="border-0" variant="muted" key={result.url} >
                <ItemMedia>
                   <Checkbox
                     id={`${checkboxIdPrefix}-${result.url}`}
                     checked={selected.includes(result.url)}
                     onCheckedChange={() => toggle(result.url)}
                   />
                </ItemMedia>
                <ItemContent>
                  <label htmlFor={`${checkboxIdPrefix}-${result.url}`}>
                  <ItemTitle>
                    {result.title}
                    </ItemTitle>
                  <ItemDescription className="text-xs space-x-1">
                    <span>{result.domain}</span> <span>·</span> <span>{result.description}</span>
                  </ItemDescription>
                    </label>
                </ItemContent>
                <ItemActions>
                  <a className="inline" href={result.url} rel="noreferrer" target="_blank">
                        <ExternalLink className="inline-block ml-1 -mt-1.5 h-4 w-4" />
                      </a>
                </ItemActions>

              </Item>
            ))}
          </ItemGroup>
        </>
      ) : null}
    </section>
  )
}
