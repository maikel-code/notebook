import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { GET } from "@/app/api/jobs/status/route"
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
  cookies: async () => ({
    getAll: () => requestCookies,
    set: vi.fn(),
  }),
}))

async function setSession(user: IntegrationUser | null): Promise<void> {
  if (!user) {
    requestCookies = []
    return
  }

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

async function statusRequest(user: IntegrationUser | null, notebookId: string): Promise<Response> {
  await setSession(user)
  return GET(new Request(`http://localhost/api/jobs/status?notebookId=${notebookId}`))
}

describe("job status access matrix", () => {
  let fixture: IntegrationFixture
  let notebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    notebookId = await createNotebookForContext(testContext(fixture.owner), "Jobs", fixture.service)
  })

  afterAll(async () => fixture.cleanup())

  it("runs the HTTP status route with real sessions and keeps ownership failures neutral", async () => {
    const sourceId = crypto.randomUUID()
    const { error: sourceError } = await fixture.service.from("sources").insert({
      byte_size: 1,
      content_hash: "a".repeat(64),
      file_name: "status.pdf",
      id: sourceId,
      notebook_id: notebookId,
      status: "processing",
      storage_path: sourceStoragePath(fixture.owner.id, notebookId, sourceId),
      user_id: fixture.owner.id,
    })
    if (sourceError) throw sourceError
    const { error: jobsError } = await fixture.service.from("ingestion_jobs").insert([
      {
        created_at: "2026-01-01T00:00:00.000Z",
        phase: "extract",
        source_id: sourceId,
        status: "running",
        user_id: fixture.owner.id,
      },
      {
        created_at: "2026-01-02T00:00:00.000Z",
        phase: "embed",
        source_id: sourceId,
        status: "queued",
        user_id: fixture.owner.id,
      },
    ])
    if (jobsError) throw jobsError
    const owner = await statusRequest(fixture.owner, notebookId)
    expect(owner.status).toBe(200)
    await expect(owner.json()).resolves.toEqual({
      sources: [{ errorReason: null, id: sourceId, phase: "embed", status: "processing" }],
    })

    const foreign = await statusRequest(fixture.stranger, notebookId)
    const missing = await statusRequest(fixture.owner, crypto.randomUUID())
    expect(foreign.status).toBe(404)
    expect(missing.status).toBe(404)
    await expect(foreign.json()).resolves.toEqual(await missing.json())

    const anonymous = await statusRequest(null, notebookId)
    expect(anonymous.status).toBe(401)
    await expect(anonymous.json()).resolves.toEqual({ error: "Anmeldung erforderlich." })
  })
})
