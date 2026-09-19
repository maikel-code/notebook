"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface ConfirmDeleteDialogProps {
  deleteAction: (formData: FormData) => Promise<never>
  notebookId: string
  notebookName: string
}

export function ConfirmDeleteDialog({
  deleteAction,
  notebookId,
  notebookName,
}: ConfirmDeleteDialogProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" disabled={!mounted}>
          Notebook löschen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notebook wirklich löschen?</DialogTitle>
          <DialogDescription>
            „{notebookName}“ und alle zugehörigen Quellen und Gespräche werden dauerhaft entfernt.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Abbrechen
            </Button>
          </DialogClose>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={notebookId} />
            <input type="hidden" name="confirmed" value="true" />
            <Button type="submit" variant="destructive">
              Endgültig löschen
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
