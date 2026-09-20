"use client"

import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import type { WorkspaceSourceDetail } from "@/lib/notebooks/workspace-service"

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  )
}

function formatBytes(value: number): string {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value / 1024)} KB`
}

export function SourceDetail({
  detail,
  onReturn,
}: {
  detail: WorkspaceSourceDetail
  onReturn: () => void
}) {
  const [sectionIndex, setSectionIndex] = useState(0)
  const titleId = useId()
  const section = detail.textSections[sectionIndex]

  return (
    <section aria-labelledby={titleId} className="grid gap-4" tabIndex={-1}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} className="font-head text-xl">
          {detail.source.fileName}
        </h2>
        <Button type="button" variant="outline" onClick={onReturn}>
          Zurück zum Arbeitsbereich
        </Button>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Typ</dt>
          <dd>{detail.source.sourceKind === "pdf" ? "PDF" : "Webquelle"}</dd>
        </div>
        <div>
          <dt className="font-medium">Status</dt>
          <dd>{detail.source.status}</dd>
        </div>
        <div>
          <dt className="font-medium">Aufgenommen</dt>
          <dd>{formatDate(detail.source.createdAt)}</dd>
        </div>
        <div>
          <dt className="font-medium">Umfang</dt>
          <dd>
            {detail.source.pageCount ? `${detail.source.pageCount} Seiten · ` : ""}
            {formatBytes(detail.source.byteSize)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium">Herkunft</dt>
          <dd>{detail.source.originUrl ?? "Hochgeladene PDF-Datei"}</dd>
        </div>
      </dl>

      {detail.overview ? (
        <section aria-label="Überblick" className="grid gap-1 border-2 p-3">
          <h3 className="font-medium">Überblick</h3>
          <p>{detail.overview}</p>
        </section>
      ) : null}

      {section ? (
        <section aria-label="Vollständiger Quellentext" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">Vollständiger Quellentext</h3>
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Seite {section.pageStart}
              {section.pageEnd !== section.pageStart ? `–${section.pageEnd}` : ""} von{" "}
              {detail.textSections.length}
            </p>
          </div>
          {detail.textSections.length > 1 ? (
            <nav aria-label="Textabschnitte" className="flex flex-wrap gap-2">
              {detail.textSections.map((textSection, index) => (
                <Button
                  aria-current={index === sectionIndex ? "page" : undefined}
                  key={`${textSection.pageStart}-${textSection.pageEnd}`}
                  type="button"
                  variant={index === sectionIndex ? "default" : "outline"}
                  onClick={() => setSectionIndex(index)}
                >
                  Seite {textSection.pageStart}
                  {textSection.pageEnd !== textSection.pageStart ? `–${textSection.pageEnd}` : ""}
                </Button>
              ))}
            </nav>
          ) : null}
          <article className="whitespace-pre-wrap border-2 p-3">{section.content}</article>
        </section>
      ) : (
        <div className="grid gap-2">
          <p role="status">{detail.absentTextReason}</p>
          <p className="text-sm text-muted-foreground">
            {detail.source.status === "failed"
              ? "Kehre zum Arbeitsbereich zurück, um die Verarbeitung erneut zu starten."
              : "Kehre zum Arbeitsbereich zurück, um eine andere Quelle auszuwählen."}
          </p>
        </div>
      )}
    </section>
  )
}
