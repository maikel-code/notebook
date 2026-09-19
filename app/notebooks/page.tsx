import Link from "next/link"
import { redirect } from "next/navigation"

import { signOutAction } from "@/app/(auth)/actions"
import { createNotebook } from "@/app/notebooks/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requireUser } from "@/lib/auth/authorize"
import { HttpError } from "@/lib/http/errors"
import { listNotebooksForContext } from "@/lib/notebooks/service"
import { createServiceSupabaseClient } from "@/lib/supabase/service"

export default async function NotebooksPage() {
  let userId: string
  try {
    userId = (await requireUser()).userId
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect("/sign-in")
    throw error
  }

  const notebooks = await listNotebooksForContext({ userId }, createServiceSupabaseClient())

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl gap-8 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-medium">Privater Arbeitsbereich</p>
          <h1 className="font-head text-4xl">Notebooks</h1>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline">
            Abmelden
          </Button>
        </form>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Neues Notebook</CardTitle>
          <CardDescription>Ein eigener Bereich für Quellen und Fragen.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createNotebook} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="notebook-name">Notebook-Name</Label>
              <Input id="notebook-name" name="name" minLength={1} maxLength={200} required />
            </div>
            <Button type="submit">Notebook anlegen</Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="notebook-list-title">
        <h2 id="notebook-list-title" className="sr-only">
          Eigene Notebooks
        </h2>
        {notebooks.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Noch keine Notebooks</CardTitle>
              <CardDescription>
                Lege dein erstes Notebook an, um später Quellen hinzuzufügen.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.map((notebook) => (
              <li key={notebook.id}>
                <Card className="relative h-full transition-transform hover:-translate-y-1">
                  <CardHeader>
                    <CardTitle>
                      <Link
                        className="after:absolute after:inset-0"
                        href={`/notebooks/${notebook.id}`}
                      >
                        {notebook.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>Privates Notebook</CardDescription>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
