import type { SupabaseClient } from "@supabase/supabase-js"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { createIntegrationFixture, type IntegrationFixture } from "@/tests/integration/setup"

const session = vi.hoisted(() => ({
  service: undefined as unknown as SupabaseClient,
  userId: null as string | null,
}))

vi.mock("@/lib/auth/authorize", async () => {
  const { unauthorizedError } = await import("@/lib/http/errors")

  return {
    requireUser: vi.fn(async () => {
      if (!session.userId) throw unauthorizedError()
      return { user: { id: session.userId }, userId: session.userId }
    }),
  }
})

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => session.service,
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND")
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`)
  },
}))

import {
  createNotebookAction,
  deleteNotebookAction,
  renameNotebookAction,
} from "@/app/notebooks/actions"

function formData(values: Record<string, string>): FormData {
  const data = new FormData()
  for (const [name, value] of Object.entries(values)) data.set(name, value)
  return data
}

describe("Notebook Server Actions", () => {
  let fixture: IntegrationFixture

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    session.service = fixture.service
  })

  afterAll(async () => {
    session.userId = null
    await fixture.cleanup()
  })

  it("derives creation ownership from the session instead of FormData", async () => {
    session.userId = fixture.owner.id

    const result = await createNotebookAction(
      {},
      formData({ name: "Session owned", user_id: fixture.stranger.id }),
    )
    expect(result).toEqual({})

    const ownerRows = await fixture.service
      .from("notebooks")
      .select("id")
      .eq("user_id", fixture.owner.id)
      .eq("name", "Session owned")
    const strangerRows = await fixture.service
      .from("notebooks")
      .select("id")
      .eq("user_id", fixture.stranger.id)
      .eq("name", "Session owned")

    expect(ownerRows.data).toHaveLength(1)
    expect(strangerRows.data).toHaveLength(0)
  })

  it("does not let a form field grant access to a stranger notebook", async () => {
    const notebook = await fixture.service
      .from("notebooks")
      .insert({ name: "Stranger notebook", user_id: fixture.stranger.id })
      .select("id")
      .single()
    if (notebook.error) throw notebook.error

    session.userId = fixture.owner.id
    await expect(
      renameNotebookAction(
        {},
        formData({ id: notebook.data.id, name: "Injected", user_id: fixture.stranger.id }),
      ),
    ).rejects.toThrow("NOT_FOUND")
  })

  it("redirects anonymous mutation attempts to sign-in", async () => {
    session.userId = null

    await expect(
      createNotebookAction({}, formData({ name: "Anonymous", user_id: fixture.owner.id })),
    ).rejects.toThrow("REDIRECT:/sign-in")
  })

  it("returns a visible conflict state for a streaming notebook deletion", async () => {
    const notebook = await fixture.service
      .from("notebooks")
      .insert({ name: "Streaming", user_id: fixture.owner.id })
      .select("id")
      .single()
    if (notebook.error) throw notebook.error

    const question = await fixture.service
      .from("messages")
      .insert({
        content: "Question",
        notebook_id: notebook.data.id,
        role: "user",
        selected_sources_snapshot: [],
        status: "complete",
        user_id: fixture.owner.id,
      })
      .select("id")
      .single()
    if (question.error) throw question.error

    const answer = await fixture.service.from("messages").insert({
      attempt_no: 1,
      content: "",
      notebook_id: notebook.data.id,
      question_message_id: question.data.id,
      role: "assistant",
      status: "streaming",
      user_id: fixture.owner.id,
    })
    if (answer.error) throw answer.error

    session.userId = fixture.owner.id
    await expect(
      deleteNotebookAction(
        {},
        formData({ confirmed: "true", id: notebook.data.id, user_id: fixture.stranger.id }),
      ),
    ).resolves.toMatchObject({ error: expect.stringContaining("laufende Antwort") })
  })
})
