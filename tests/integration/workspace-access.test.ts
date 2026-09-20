import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { sourceStoragePath } from "@/lib/ingestion/storage"
import { prepareUploadForContext } from "@/lib/ingestion/upload"
import { createNotebookForContext } from "@/lib/notebooks/service"
import {
  getSourceDetailForContext,
  getWorkspaceSnapshotForContext,
} from "@/lib/notebooks/workspace-service"
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

describe("workspace owner-scoped services", () => {
  let fixture: IntegrationFixture
  let ownerNotebookId: string
  let ownerSourceId: string
  let answerMessageId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    ownerNotebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Workspace owner",
      fixture.service,
    )
    ownerSourceId = randomUUID()
    const { error: sourceError } = await fixture.service.from("sources").insert({
      byte_size: 1,
      content_hash: randomUUID().replaceAll("-", "").repeat(2),
      file_name: "owner.pdf",
      id: ownerSourceId,
      notebook_id: ownerNotebookId,
      page_count: 1,
      status: "ready",
      storage_path: sourceStoragePath(fixture.owner.id, ownerNotebookId, ownerSourceId),
      user_id: fixture.owner.id,
    })
    if (sourceError) throw sourceError

    const chunkId = randomUUID()
    const { error: chunkError } = await fixture.service.from("chunks").insert({
      char_count: "Belegter Quellentext".length,
      content: "Belegter Quellentext",
      embedding: Array.from({ length: 1536 }, () => 0),
      id: chunkId,
      ordinal: 0,
      page_end: 1,
      page_start: 1,
      source_id: ownerSourceId,
      user_id: fixture.owner.id,
    })
    if (chunkError) throw chunkError

    answerMessageId = (
      await persistVerifiedAnswer(
        {
          citations: [
            {
              chunkId,
              ordinal: 0,
              pageEnd: 1,
              pageStart: 1,
              quote: "Belegter Quellentext",
              sourceId: ownerSourceId,
              sourceName: "owner.pdf",
            },
          ],
          content: "Vollständig belegte Antwort.",
          notebookId: ownerNotebookId,
          questionContent: "Was belegt die Quelle?",
          userId: fixture.owner.id,
        },
        fixture.service,
      )
    ).id
  })

  afterAll(async () => fixture.cleanup())

  it("returns source detail and a workspace snapshot only to the owner", async () => {
    await expect(
      getSourceDetailForContext(
        testContext(fixture.owner),
        ownerNotebookId,
        ownerSourceId,
        fixture.service,
      ),
    ).resolves.toMatchObject({ id: ownerSourceId, notebookId: ownerNotebookId })
    await expect(
      getWorkspaceSnapshotForContext(testContext(fixture.owner), ownerNotebookId, fixture.service),
    ).resolves.toMatchObject({
      notebook: expect.objectContaining({ id: ownerNotebookId }),
      sources: [expect.objectContaining({ id: ownerSourceId })],
    })

    for (const context of [testContext(fixture.stranger), null]) {
      await expect(
        getSourceDetailForContext(context, ownerNotebookId, ownerSourceId, fixture.service),
      ).rejects.toMatchObject({ status: context ? 404 : 401 })
      await expect(
        getWorkspaceSnapshotForContext(context, ownerNotebookId, fixture.service),
      ).rejects.toMatchObject({ status: context ? 404 : 401 })
    }
  })

  it("authorizes source preparation through the existing import boundary", async () => {
    const ownerResult = await prepareUploadForContext(
      testContext(fixture.owner),
      {
        byteSize: 1,
        contentHash: randomUUID().replaceAll("-", "").repeat(2),
        fileName: "owner-import.pdf",
        notebookId: ownerNotebookId,
      },
      fixture.service,
    )
    expect(ownerResult).toMatchObject({ decision: "ok" })

    await expect(
      prepareUploadForContext(
        testContext(fixture.stranger),
        {
          byteSize: 1,
          contentHash: randomUUID().replaceAll("-", "").repeat(2),
          fileName: "foreign-import.pdf",
          notebookId: ownerNotebookId,
        },
        fixture.service,
      ),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      prepareUploadForContext(
        null,
        {
          byteSize: 1,
          contentHash: randomUUID().replaceAll("-", "").repeat(2),
          fileName: "anonymous-import.pdf",
          notebookId: ownerNotebookId,
        },
        fixture.service,
      ),
    ).rejects.toMatchObject({ status: 401 })
  })

  it("persists and reads a studio note only in the owner notebook", async () => {
    const note = await saveStudioNoteForContext(
      testContext(fixture.owner),
      { messageId: answerMessageId, notebookId: ownerNotebookId },
      fixture.service,
    )
    expect(note).toMatchObject({ messageId: answerMessageId, notebookId: ownerNotebookId })

    await expect(
      listStudioNotesForContext(testContext(fixture.owner), ownerNotebookId, fixture.service),
    ).resolves.toEqual([expect.objectContaining({ id: note.id })])
    await expect(
      getStudioNoteForContext(
        testContext(fixture.owner),
        ownerNotebookId,
        note.id,
        fixture.service,
      ),
    ).resolves.toMatchObject({ contentSnapshot: "Vollständig belegte Antwort.", id: note.id })

    for (const context of [testContext(fixture.stranger), null]) {
      await expect(
        saveStudioNoteForContext(
          context,
          { messageId: answerMessageId, notebookId: ownerNotebookId },
          fixture.service,
        ),
      ).rejects.toMatchObject({ status: context ? 404 : 401 })
      await expect(
        listStudioNotesForContext(context, ownerNotebookId, fixture.service),
      ).rejects.toMatchObject({ status: context ? 404 : 401 })
      await expect(
        getStudioNoteForContext(context, ownerNotebookId, note.id, fixture.service),
      ).rejects.toMatchObject({ status: context ? 404 : 401 })
    }
  })
})
