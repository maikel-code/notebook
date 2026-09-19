"use client"

import { useActionState, useEffect, useState } from "react"

import {
  createNotebookAction,
  type NotebookActionState,
  renameNotebookAction,
} from "@/app/notebooks/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: NotebookActionState = {}

function ActionError({ error }: NotebookActionState) {
  if (!error) return null

  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {error}
    </p>
  )
}

export function CreateNotebookForm() {
  const [state, formAction, pending] = useActionState(createNotebookAction, initialState)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      data-hydrated={mounted}
    >
      <div className="grid flex-1 gap-2">
        <Label htmlFor="notebook-name">Notebook-Name</Label>
        <Input id="notebook-name" name="name" minLength={1} maxLength={200} required />
        <ActionError error={state.error} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Wird angelegt…" : "Notebook anlegen"}
      </Button>
    </form>
  )
}

interface RenameNotebookFormProps {
  notebookId: string
  notebookName: string
}

export function RenameNotebookForm({ notebookId, notebookName }: RenameNotebookFormProps) {
  const [state, formAction, pending] = useActionState(renameNotebookAction, initialState)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      data-hydrated={mounted}
    >
      <input type="hidden" name="id" value={notebookId} />
      <div className="grid flex-1 gap-2">
        <Label htmlFor="new-notebook-name">Neuer Notebook-Name</Label>
        <Input
          id="new-notebook-name"
          name="name"
          defaultValue={notebookName}
          minLength={1}
          maxLength={200}
          required
        />
        <ActionError error={state.error} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Wird gespeichert…" : "Umbenennen"}
      </Button>
    </form>
  )
}
