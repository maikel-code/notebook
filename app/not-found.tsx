import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-lg place-content-center gap-4 px-4 text-center">
      <h1 className="font-head text-4xl">Nicht gefunden</h1>
      <p>Dieses Notebook ist nicht vorhanden oder nicht für dich zugänglich.</p>
      <Button asChild>
        <Link href="/notebooks">Zu meinen Notebooks</Link>
      </Button>
    </main>
  )
}
