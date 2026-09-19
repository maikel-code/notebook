import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { ConfirmDeleteDialog } from "@/components/notebook/confirm-delete-dialog"
import { RenameNotebookForm } from "@/components/notebook/notebook-forms"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireUser } from "@/lib/auth/authorize"
import { HttpError } from "@/lib/http/errors"
import { getNotebookForContext } from "@/lib/notebooks/service"
import { createServiceSupabaseClient } from "@/lib/supabase/service"

interface NotebookPageProps {
  params: Promise<{ notebookId: string }>
}

export default async function NotebookPage({ params }: NotebookPageProps) {
  const { notebookId } = await params
  try {
    const { userId } = await requireUser()
    const notebook = await getNotebookForContext(
      { userId },
      notebookId,
      createServiceSupabaseClient(),
    )

    return (
      <main className="mx-auto grid min-h-screen max-w-4xl content-start gap-8 px-4 py-10">
        <Button asChild variant="link" className="w-fit px-0">
          <Link href="/notebooks">← Alle Notebooks</Link>
        </Button>
        <header>
          <p className="font-medium">Privates Notebook</p>
          <h1 className="font-head text-4xl">{notebook.name}</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Notebook umbenennen</CardTitle>
            <CardDescription>Der Name ist nur für dich sichtbar.</CardDescription>
          </CardHeader>
          <CardContent>
            <RenameNotebookForm notebookId={notebook.id} notebookName={notebook.name} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notebook löschen</CardTitle>
            <CardDescription>Diese Aktion entfernt alle zugehörigen Daten.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmDeleteDialog notebookId={notebook.id} notebookName={notebook.name} />
          </CardContent>
        </Card>
      </main>
    )
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401) redirect("/sign-in")
      if (error.status === 404) notFound()
    }
    throw error
  }
}
