"use client"

import { useActionState, useEffect, useState } from "react"

import { deleteNotebookAction, type NotebookActionState } from "@/app/notebooks/actions"
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
  notebookId: string
  notebookName: string
}

const initialState: NotebookActionState = {}

export function ConfirmDeleteDialog({ notebookId, notebookName }: ConfirmDeleteDialogProps) {
  const [mounted, setMounted] = useState(false)
  const [state, formAction, pending] = useActionState(deleteNotebookAction, initialState)

  useEffect(() => setMounted(true), [])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" data-hydrated={mounted}>
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
          <form action={formAction} data-hydrated={mounted}>
            <input type="hidden" name="id" value={notebookId} />
            <input type="hidden" name="confirmed" value="true" />
            {state.error ? (
              <p role="alert" className="mb-2 text-sm font-medium text-destructive">
                {state.error}
              </p>
            ) : null}
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Wird gelöscht…" : "Endgültig löschen"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
