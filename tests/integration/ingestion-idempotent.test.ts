import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { replaceChunksForSource } from "@/lib/ingestion/persist"
import { sourceStoragePath } from "@/lib/ingestion/storage"
import { createNotebookForContext } from "@/lib/notebooks/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("idempotent ingestion", () => {
  let fixture: IntegrationFixture
  let sourceId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    const notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Chunks",
      fixture.service,
    )
    sourceId = crypto.randomUUID()
    const { error } = await fixture.service.from("sources").insert({
      byte_size: 12,
      content_hash: "b".repeat(64),
      file_name: "chunks.pdf",
      id: sourceId,
      notebook_id: notebookId,
      page_count: 1,
      status: "processing",
      storage_path: sourceStoragePath(fixture.owner.id, notebookId, sourceId),
      user_id: fixture.owner.id,
    })
    if (error) throw error
  })

  afterAll(async () => fixture.cleanup())

  it("replaces chunks atomically without duplicate ordinals", async () => {
    const chunks = [
      {
        charCount: 4,
        content: "Text",
        embedding: Array.from({ length: 1536 }, () => 0),
        ordinal: 0,
        pageEnd: 1,
        pageStart: 1,
      },
    ]
    await replaceChunksForSource(fixture.service, sourceId, fixture.owner.id, chunks)
    await replaceChunksForSource(fixture.service, sourceId, fixture.owner.id, chunks)
    const { data, error } = await fixture.service
      .from("chunks")
      .select("id")
      .eq("source_id", sourceId)
    if (error) throw error
    expect(data).toHaveLength(1)
  })
})
