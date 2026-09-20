import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { sourceStoragePath } from "@/lib/ingestion/storage"
import { createNotebookForContext } from "@/lib/notebooks/service"
import { persistVerifiedAnswer } from "@/lib/rag/persist-answer"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("answer persistence", () => {
  let fixture: IntegrationFixture
  let notebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Answers",
      fixture.service,
    )
  })

  afterAll(async () => fixture.cleanup())

  it("commits a complete answer and every citation atomically", async () => {
    const sourceId = crypto.randomUUID()
    const chunkId = crypto.randomUUID()
    const { error: sourceError } = await fixture.service.from("sources").insert({
      byte_size: 1,
      content_hash: crypto.randomUUID().replaceAll("-", "").repeat(2),
      file_name: "source.pdf",
      id: sourceId,
      is_selected: true,
      notebook_id: notebookId,
      status: "ready",
      storage_path: sourceStoragePath(fixture.owner.id, notebookId, sourceId),
      user_id: fixture.owner.id,
    })
    if (sourceError) throw sourceError
    const { error: chunkError } = await fixture.service.from("chunks").insert({
      char_count: "Verifizierter Wortlaut".length,
      content: "Verifizierter Wortlaut",
      embedding: Array.from({ length: 1536 }, () => 0),
      id: chunkId,
      ordinal: 0,
      page_end: 1,
      page_start: 1,
      source_id: sourceId,
      user_id: fixture.owner.id,
    })
    if (chunkError) throw chunkError
    const result = await persistVerifiedAnswer(
      {
        citations: [
          {
            chunkId,
            ordinal: 0,
            pageEnd: 1,
            pageStart: 1,
            quote: "Verifizierter Wortlaut",
            sourceId,
            sourceName: "source.pdf",
          },
        ],
        content: "Vollständig belegte Antwort.",
        notebookId,
        questionContent: "Was steht in der Quelle?",
        userId: fixture.owner.id,
      },
      fixture.service,
    )

    expect(result.status).toBe("complete")
    const { data: citations } = await fixture.service
      .from("citations")
      .select("id")
      .eq("message_id", result.id)
    expect(citations).toHaveLength(1)
  })

  it("persists the full invalid draft with its permanent marker and no citations", async () => {
    const result = await persistVerifiedAnswer(
      {
        citations: [],
        content: "Ungeprüfter vollständiger Entwurf.",
        notebookId,
        questionContent: "Was steht in der Quelle?",
        status: "invalid",
        unsupportedReason: "invalid_citations",
        userId: fixture.owner.id,
      },
      fixture.service,
    )

    expect(result).toMatchObject({ status: "invalid", unsupportedReason: "invalid_citations" })
    const { data: citations } = await fixture.service
      .from("citations")
      .select("id")
      .eq("message_id", result.id)
    expect(citations).toEqual([])
    expect(result.displayLabel).toBe("ungeprüft und nicht belegt")
  })
})
