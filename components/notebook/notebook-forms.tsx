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
import {Edit} from "lucide-react";

const initialState: NotebookActionState = {}

function ActionError({ error, id }: NotebookActionState & { id: string }) {
  if (!error) return null

  return (
    <p id={id} role="alert" className="text-sm font-medium text-destructive">
      {error}
    </p>
  )
}

export function CreateNotebookForm() {
  const [state, formAction, pending] = useActionState(createNotebookAction, initialState)
  const [mounted, setMounted] = useState(false)
  const errorId = "create-notebook-name-error"

  useEffect(() => setMounted(true), [])

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      data-hydrated={mounted}
    >
      <div className="grid flex-1 gap-2">
        <Label htmlFor="notebook-name">Notebook-Name</Label>
        <Input
          aria-describedby={state.error ? errorId : undefined}
          aria-invalid={Boolean(state.error)}
          id="notebook-name"
          name="name"
          minLength={1}
          maxLength={200}
          required
        />
        <ActionError error={state.error} id={errorId} />
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
  const [editName, setEditName] = useState(false)
  const [state, formAction, pending] = useActionState(
    async (previousState: NotebookActionState, formData: FormData) => {
      const result = await renameNotebookAction(previousState, formData)
      if (!result.error) setEditName(false)
      return result
    },
    initialState,
  )
  const [mounted, setMounted] = useState(false)
  const errorId = "rename-notebook-name-error"

  useEffect(() => setMounted(true), [])

  if(!editName) return ( <div className="flex items-center justify-between gap-2">
    <h1 className="font-head text-4xl">{notebookName}</h1>
    <Button onClick={() => setEditName(true)}><Edit /></Button>
  </div> )

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      data-hydrated={mounted}
    >
      <input type="hidden" name="id" value={notebookId} />
      <div className="grid flex-1 gap-2">
        <Input
          aria-describedby={state.error ? errorId : undefined}
          aria-invalid={Boolean(state.error)}
          id="new-notebook-name"
          name="name"
          defaultValue={notebookName}
          minLength={1}
          maxLength={200}
          required
        />
        <ActionError error={state.error} id={errorId} />
      </div>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Wird gespeichert…" : "Umbenennen"}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setEditName(false)}>Abbrechen</Button>
    </form>
  )
}
