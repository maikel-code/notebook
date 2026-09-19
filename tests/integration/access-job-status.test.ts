import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { listJobStatusForContext } from "@/lib/ingestion/status"
import { sourceStoragePath } from "@/lib/ingestion/storage"
import { createNotebookForContext } from "@/lib/notebooks/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("job status access matrix", () => {
  let fixture: IntegrationFixture
  let notebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    notebookId = await createNotebookForContext(testContext(fixture.owner), "Jobs", fixture.service)
  })

  afterAll(async () => fixture.cleanup())

  it("requires an owner context", async () => {
    await expect(listJobStatusForContext(null, "missing", {} as never)).rejects.toMatchObject({
      status: 401,
    })
  })

  it("returns only the owner's notebook status and hides foreign or missing notebooks", async () => {
    await expect(
      listJobStatusForContext(testContext(fixture.owner), notebookId, fixture.service),
    ).resolves.toEqual([])
    await expect(
      listJobStatusForContext(testContext(fixture.stranger), notebookId, fixture.service),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      listJobStatusForContext(testContext(fixture.owner), crypto.randomUUID(), fixture.service),
    ).rejects.toMatchObject({ status: 404 })
  })

  it("reports the newest job deterministically", async () => {
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
    await expect(
      listJobStatusForContext(testContext(fixture.owner), notebookId, fixture.service),
    ).resolves.toContainEqual(expect.objectContaining({ id: sourceId, phase: "embed" }))
  })
})
