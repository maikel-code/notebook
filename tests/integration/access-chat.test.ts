import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { POST } from "@/app/api/chat/route"
import { sourceStoragePath } from "@/lib/ingestion/storage"
import { createNotebookForContext } from "@/lib/notebooks/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  type IntegrationUser,
  integrationEnvironment,
  testContext,
} from "@/tests/integration/setup"

let requestCookies: Array<{ name: string; value: string }> = []

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => requestCookies, set: vi.fn() }),
}))

async function setSession(user: IntegrationUser | null): Promise<void> {
  requestCookies = []
  if (!user) return
  const {
    data: { session },
    error,
  } = await user.client.auth.getSession()
  if (error || !session) throw error ?? new Error("Test session is missing")
  const storageKey = `sb-${new URL(integrationEnvironment.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]}-auth-token`
  requestCookies = [
    {
      name: storageKey,
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
    },
  ]
}

async function postChat(
  user: IntegrationUser | null,
  body: Record<string, unknown>,
): Promise<Response> {
  await setSession(user)
  return POST(
    new Request("http://localhost/api/chat", {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  )
}

async function seedSource(
  fixture: IntegrationFixture,
  notebookId: string,
  status: "processing" | "ready",
): Promise<void> {
  const sourceId = crypto.randomUUID()
  const { error } = await fixture.service.from("sources").insert({
    byte_size: 1,
    content_hash: "a".repeat(64),
    file_name: `${status}.pdf`,
    id: sourceId,
    notebook_id: notebookId,
    status,
    storage_path: sourceStoragePath(fixture.owner.id, notebookId, sourceId),
    user_id: fixture.owner.id,
  })
  if (error) throw error
}

describe("chat access and preconditions", () => {
  let fixture: IntegrationFixture
  let notebookId: string
  let noReadySourceNotebookId: string
  let belowThresholdNotebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    notebookId = await createNotebookForContext(testContext(fixture.owner), "Chat", fixture.service)
    noReadySourceNotebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "No ready source",
      fixture.service,
    )
    belowThresholdNotebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Below threshold",
      fixture.service,
    )
    await seedSource(fixture, noReadySourceNotebookId, "processing")
    await seedSource(fixture, belowThresholdNotebookId, "ready")
  })
  afterAll(async () => fixture.cleanup())

  it("keeps foreign and missing notebooks indistinguishable and rejects anonymous calls", async () => {
    const owner = await postChat(fixture.owner, { notebookId, question: "Frage" })
    expect(owner.status).toBe(200)
    const foreign = await postChat(fixture.stranger, { notebookId, question: "Frage" })
    const missing = await postChat(fixture.owner, {
      notebookId: crypto.randomUUID(),
      question: "Frage",
    })
    expect(foreign.status).toBe(404)
    await expect(foreign.json()).resolves.toEqual(await missing.json())
    expect((await postChat(null, { notebookId, question: "Frage" })).status).toBe(401)
  })

  it.each([
    ["no source is selected", () => notebookId, "no_selection"],
    ["no selected source is ready", () => noReadySourceNotebookId, "no_ready_source"],
    [
      "every score is below the minimum",
      () => belowThresholdNotebookId,
      "below_similarity_threshold",
    ],
    ["the question exceeds 2,000 characters", () => notebookId, "INVALID_INPUT"],
  ])(
    "returns a deterministic terminal result when %s",
    async (_label, getNotebookId, expectedCode) => {
      const response = await postChat(fixture.owner, {
        notebookId: getNotebookId(),
        question: "x".repeat(expectedCode === "INVALID_INPUT" ? 2001 : 1),
      })
      await expect(response.json()).resolves.toMatchObject({ code: expectedCode })
    },
  )
})
