"use client"

import { useRouter } from "next/navigation"
import { type ChangeEvent, useRef, useState } from "react"

import { cancelUpload, confirmUpload, prepareUpload } from "@/app/notebooks/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SOURCES_BUCKET } from "@/lib/ingestion/storage"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { sha256Hex } from "@/lib/upload/hash"

type UploadStage = "duplicate" | "error" | "idle" | "processing" | "uploading"

interface DuplicateUpload {
  existingSourceId: string
  file: File
}

export function SourceUpload({ notebookId }: { notebookId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateUpload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<UploadStage>("idle")

  function finishUpload() {
    setActiveSourceId(null)
    setStage("idle")
    if (inputRef.current) inputRef.current.value = ""
  }

  function failUpload(uploadError: unknown) {
    setStage("error")
    setActiveSourceId(null)
    setError(uploadError instanceof Error ? uploadError.message : "Upload fehlgeschlagen.")
  }

  async function completeUpload(
    file: File,
    intent?: "add" | "replace",
    replaceSourceId?: string,
  ): Promise<boolean> {
    const contentHash = await sha256Hex(await file.arrayBuffer())
    const prepared = await prepareUpload({
      byteSize: file.size,
      contentHash,
      fileName: file.name,
      intent,
      notebookId,
      replaceSourceId,
    })
    if (prepared.decision === "rejected") throw new Error(prepared.reason)
    if (prepared.decision === "duplicate") {
      setDuplicate({ existingSourceId: prepared.existingSourceId, file })
      setStage("duplicate")
      return false
    }
    setActiveSourceId(prepared.sourceId)
    router.refresh()
    try {
      const client = createBrowserSupabaseClient()
      const { error: storageError } = await client.storage
        .from(SOURCES_BUCKET)
        .upload(prepared.storagePath, file, { contentType: "application/pdf", upsert: false })
      if (storageError) throw new Error("Die Datei konnte nicht hochgeladen werden.")
      setStage("processing")
      await confirmUpload(prepared.sourceId)
      return true
    } catch (uploadError) {
      await cancelUpload(prepared.sourceId).catch(() => undefined)
      router.refresh()
      throw uploadError
    }
  }

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setStage("uploading")
    setError(null)
    try {
      const completed = await completeUpload(file)
      if (!completed) return
      router.refresh()
    } catch (uploadError) {
      failUpload(uploadError)
      return
    }
    finishUpload()
  }

  async function resolveDuplicate(intent: "add" | "replace") {
    if (!duplicate) return
    const selection = duplicate
    setDuplicate(null)
    setStage("uploading")
    try {
      const completed = await completeUpload(
        selection.file,
        intent,
        intent === "replace" ? selection.existingSourceId : undefined,
      )
      if (completed) finishUpload()
    } catch (uploadError) {
      failUpload(uploadError)
    }
  }

  function dismissDuplicate() {
    setDuplicate(null)
    finishUpload()
  }

  async function cancelActiveUpload() {
    if (!activeSourceId || stage !== "uploading") return
    try {
      await cancelUpload(activeSourceId)
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Upload konnte nicht abgebrochen werden.",
      )
      return
    }
    setActiveSourceId(null)
    setStage("idle")
    if (inputRef.current) inputRef.current.value = ""
    router.refresh()
  }

  return (
    <div className="grid gap-3">
      <Label htmlFor="source-file">PDF-Quelle hinzufügen</Label>
      <Input
        ref={inputRef}
        id="source-file"
        accept="application/pdf,.pdf"
        aria-describedby={error ? "source-upload-error" : undefined}
        aria-invalid={Boolean(error)}
        disabled={stage === "uploading"}
        onChange={onChange}
        type="file"
      />
      {stage === "uploading" ? <p role="status">Datei wird hochgeladen…</p> : null}
      {stage === "processing" ? <p role="status">Quelle wird verarbeitet…</p> : null}
      {error ? (
        <p id="source-upload-error" role="alert">
          {error}
        </p>
      ) : null}
      {stage === "uploading" ? (
        <Button type="button" variant="outline" onClick={cancelActiveUpload}>
          Upload abbrechen
        </Button>
      ) : null}
      <Dialog open={stage === "duplicate"} onOpenChange={(open) => !open && dismissDuplicate()}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Datei bereits vorhanden</DialogTitle>
            <DialogDescription>
              Soll die vorhandene Quelle ersetzt oder die Datei zusätzlich aufgenommen werden?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={dismissDuplicate}>
              Abbrechen
            </Button>
            <Button type="button" variant="outline" onClick={() => resolveDuplicate("add")}>
              Zusätzlich aufnehmen
            </Button>
            <Button type="button" onClick={() => resolveDuplicate("replace")}>
              Ersetzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
