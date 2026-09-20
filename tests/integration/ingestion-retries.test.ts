import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { runNextIngestionJob } from "@/lib/ingestion/run-job"
import { sourceStoragePath } from "@/lib/ingestion/storage"
import { retryIngestionForContext } from "@/lib/ingestion/upload"
import { createNotebookForContext } from "@/lib/notebooks/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("ingestion retries", () => {
  let fixture: IntegrationFixture

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
  })

  afterAll(async () => fixture.cleanup())

  it("fails after three automatic attempts and resets a manual retry to zero", async () => {
    const notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Retries",
      fixture.service,
    )
    const sourceId = crypto.randomUUID()
    const { error: sourceError } = await fixture.service.from("sources").insert({
      byte_size: 1,
      content_hash: "c".repeat(64),
      file_name: "missing.pdf",
      id: sourceId,
      notebook_id: notebookId,
      status: "processing",
      storage_path: sourceStoragePath(fixture.owner.id, notebookId, sourceId),
      user_id: fixture.owner.id,
    })
    if (sourceError) throw sourceError
    const { error: jobError } = await fixture.service.from("ingestion_jobs").insert({
      source_id: sourceId,
      status: "queued",
      user_id: fixture.owner.id,
    })
    if (jobError) throw jobError
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(runNextIngestionJob(fixture.service, sourceId)).resolves.toBe(true)
    }
    const { data: failedSource, error: failedSourceError } = await fixture.service
      .from("sources")
      .select("status")
      .eq("id", sourceId)
      .single()
    if (failedSourceError) throw failedSourceError
    expect(failedSource.status).toBe("failed")
    await retryIngestionForContext(testContext(fixture.owner), sourceId, fixture.service)
    const { data: retry, error: retryError } = await fixture.service
      .from("ingestion_jobs")
      .select("attempt, status")
      .eq("source_id", sourceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    if (retryError) throw retryError
    expect(retry).toEqual({ attempt: 0, status: "queued" })
  })
})
