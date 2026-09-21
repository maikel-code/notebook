"use client"

import { CitationChip } from "@/components/notebook/citation-chip"
import { Button } from "@/components/ui/button"
import type { StudioNote } from "@/lib/studio/service"

interface StudioNotePreview {
  createdAt: string
  id: string
  messageId: string
  title: string
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  )
}

export function StudioNotes({
  notebookId,
  notes,
  selectedNote,
  onSelect,
}: {
  notebookId: string
  notes: StudioNotePreview[]
  selectedNote: StudioNote | null
  onSelect: (noteId: string | null) => void
}) {
  return (
    <section aria-label="Studio-Notizen" className="grid gap-4">
      {selectedNote ? (
        <article aria-label="Studio-Notiz" className="grid gap-3 rounded-md border p-3">
          <div>
            <h3 className="font-semibold">{selectedNote.title}</h3>
            <p className="text-sm text-muted-foreground">{dateLabel(selectedNote.createdAt)}</p>
          </div>
          {selectedNote.contentSnapshot.split("\n\n").map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <div>
            {selectedNote.citations.map((citation) => (
              <CitationChip key={citation.id} notebookId={notebookId} {...citation} />
            ))}
          </div>
        </article>
      ) : null}
      {notes.length ? (
        <div className="grid gap-2">
          {notes.map((note) => (
            <Button
              key={note.id}
              aria-pressed={selectedNote?.id === note.id}
              className="h-auto justify-start whitespace-normal text-left"
              type="button"
              variant={selectedNote?.id === note.id ? "default" : "outline"}
              onClick={() => onSelect(selectedNote?.id === note.id ? null : note.id)}
            >
              <span className="grid gap-1">
                <span>{note.title}</span>
                <span className="text-xs text-muted-foreground">{dateLabel(note.createdAt)}</span>
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Studio-Notizen vorhanden.</p>
      )}
    </section>
  )
}
