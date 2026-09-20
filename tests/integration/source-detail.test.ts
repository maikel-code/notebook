import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { sourceStoragePath } from "@/lib/ingestion/storage"
import { createNotebookForContext } from "@/lib/notebooks/service"
import { getSourceDetailForContext } from "@/lib/notebooks/workspace-service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("source detail", () => {
  let fixture: IntegrationFixture
  let notebookId: string
  let sourceId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Source detail",
      fixture.service,
    )
    sourceId = randomUUID()
    const { error: sourceError } = await fixture.service.from("sources").insert({
      byte_size: 1200,
      content_hash: randomUUID().replaceAll("-", "").repeat(2),
      file_name: "detail.pdf",
      id: sourceId,
      notebook_id: notebookId,
      page_count: 2,
      status: "ready",
      storage_path: sourceStoragePath(fixture.owner.id, notebookId, sourceId),
      user_id: fixture.owner.id,
    })
    if (sourceError) throw sourceError

    const { error: chunkError } = await fixture.service.from("chunks").insert([
      {
        char_count: "Seite zwei".length,
        content: "Seite zwei",
        embedding: Array.from({ length: 1536 }, () => 0),
        id: randomUUID(),
        ordinal: 1,
        page_end: 2,
        page_start: 2,
        source_id: sourceId,
        user_id: fixture.owner.id,
      },
      {
        char_count: "Seite eins".length,
        content: "Seite eins",
        embedding: Array.from({ length: 1536 }, () => 0),
        id: randomUUID(),
        ordinal: 0,
        page_end: 1,
        page_start: 1,
        source_id: sourceId,
        user_id: fixture.owner.id,
      },
    ])
    if (chunkError) throw chunkError
  })

  afterAll(async () => fixture.cleanup())

  it("returns complete ordered text only to the notebook owner", async () => {
    await expect(
      getSourceDetailForContext(testContext(fixture.owner), notebookId, sourceId, fixture.service),
    ).resolves.toMatchObject({
      source: { id: sourceId },
      textSections: [
        { content: "Seite eins", pageStart: 1 },
        { content: "Seite zwei", pageStart: 2 },
      ],
    })

    for (const context of [testContext(fixture.stranger), null]) {
      await expect(
        getSourceDetailForContext(context, notebookId, sourceId, fixture.service),
      ).rejects.toMatchObject({ status: context ? 404 : 401 })
    }
  })

  it("does not leave a removed source readable", async () => {
    const { error } = await fixture.service.from("sources").delete().eq("id", sourceId)
    if (error) throw error

    await expect(
      getSourceDetailForContext(testContext(fixture.owner), notebookId, sourceId, fixture.service),
    ).rejects.toMatchObject({ status: 404 })
  })
})
