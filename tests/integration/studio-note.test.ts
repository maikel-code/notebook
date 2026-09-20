import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { sourceStoragePath } from "@/lib/ingestion/storage"
import { createNotebookForContext } from "@/lib/notebooks/service"
import { persistVerifiedAnswer } from "@/lib/rag/persist-answer"
import {
  getStudioNoteForContext,
  listStudioNotesForContext,
  saveStudioNoteForContext,
} from "@/lib/studio/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("studio note persistence", () => {
  let fixture: IntegrationFixture
  let notebookId: string
  let answerMessageId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Studio",
      fixture.service,
    )
    const sourceId = randomUUID()
    const chunkId = randomUUID()
    await fixture.service.from("sources").insert({
      byte_size: 1,
      content_hash: randomUUID().replaceAll("-", "").repeat(2),
      file_name: "source.pdf",
      id: sourceId,
      notebook_id: notebookId,
      page_count: 1,
      status: "ready",
      storage_path: sourceStoragePath(fixture.owner.id, notebookId, sourceId),
      user_id: fixture.owner.id,
    })
    await fixture.service.from("chunks").insert({
      char_count: 16,
      content: "Belegter Inhalt.",
      embedding: Array.from({ length: 1536 }, () => 0),
      id: chunkId,
      ordinal: 0,
      page_end: 1,
      page_start: 1,
      source_id: sourceId,
      user_id: fixture.owner.id,
    })
    answerMessageId = (
      await persistVerifiedAnswer(
        {
          citations: [
            {
              chunkId,
              ordinal: 0,
              pageEnd: 1,
              pageStart: 1,
              quote: "Belegter Inhalt.",
              sourceId,
              sourceName: "source.pdf",
            },
          ],
          content: "Die Quelle enthält einen belegten Inhalt.",
          notebookId,
          questionContent: "Was enthält die Quelle?",
          userId: fixture.owner.id,
        },
        fixture.service,
      )
    ).id
  })

  afterAll(async () => fixture.cleanup())

  it("saves one immutable note and returns its citations only to the owner", async () => {
    const first = await saveStudioNoteForContext(
      testContext(fixture.owner),
      { messageId: answerMessageId, notebookId },
      fixture.service,
    )
    const second = await saveStudioNoteForContext(
      testContext(fixture.owner),
      { messageId: answerMessageId, notebookId },
      fixture.service,
    )

    expect(second.id).toBe(first.id)
    await expect(
      listStudioNotesForContext(testContext(fixture.owner), notebookId, fixture.service),
    ).resolves.toEqual([
      expect.objectContaining({ id: first.id, title: "Was enthält die Quelle?" }),
    ])
    await expect(
      getStudioNoteForContext(testContext(fixture.owner), notebookId, first.id, fixture.service),
    ).resolves.toMatchObject({
      citations: [expect.objectContaining({ quote: "Belegter Inhalt." })],
      contentSnapshot: "Die Quelle enthält einen belegten Inhalt.",
    })
    await expect(
      getStudioNoteForContext(testContext(fixture.stranger), notebookId, first.id, fixture.service),
    ).rejects.toMatchObject({ status: 404 })
  })
})
