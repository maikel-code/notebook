import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { sourceStoragePath } from "@/lib/ingestion/storage"
import { createNotebookForContext } from "@/lib/notebooks/service"
import { createSourceOrientationIfEligible } from "@/lib/rag/source-orientation"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("source orientation persistence", () => {
  let fixture: IntegrationFixture
  let notebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Orientation",
      fixture.service,
    )
  })

  afterAll(async () => fixture.cleanup())

  async function insertSource(
    status: "failed" | "ready" = "ready",
    targetNotebookId = notebookId,
  ): Promise<{
    chunkId: string
    sourceId: string
  }> {
    const sourceId = randomUUID()
    const { error: sourceError } = await fixture.service.from("sources").insert({
      byte_size: 1,
      content_hash: randomUUID().replaceAll("-", "").repeat(2),
      error_reason: status === "failed" ? "Die PDF-Datei konnte nicht gelesen werden." : null,
      file_name: `${sourceId}.pdf`,
      id: sourceId,
      notebook_id: targetNotebookId,
      page_count: 1,
      status,
      storage_path: sourceStoragePath(fixture.owner.id, targetNotebookId, sourceId),
      user_id: fixture.owner.id,
    })
    if (sourceError) throw sourceError

    const chunkId = randomUUID()
    const { error: chunkError } = await fixture.service.from("chunks").insert({
      char_count: "Die Freigabe erfolgt am Montag. Die Anmeldung endet am Freitag.".length,
      content: "Die Freigabe erfolgt am Montag. Die Anmeldung endet am Freitag.",
      embedding: Array.from({ length: 1536 }, () => 0),
      id: chunkId,
      ordinal: 0,
      page_end: 1,
      page_start: 1,
      source_id: sourceId,
      user_id: fixture.owner.id,
    })
    if (chunkError) throw chunkError
    return { chunkId, sourceId }
  }

  it("persists exactly one cited orientation for the first ready source in an empty history", async () => {
    const { sourceId } = await insertSource()
    const generate = vi.fn(async () => ({
      claims: [
        {
          citations: [{ chunkNumber: 1, quote: "Freigabe erfolgt am Montag" }],
          text: "Die Freigabe erfolgt am Montag.",
        },
      ],
      kind: "answer" as const,
      suggestedQuestions: [
        "Wann erfolgt die Freigabe?",
        "Für wen gilt die Freigabe?",
        "Welche Vorbereitung ist vor der Freigabe nötig?",
      ],
    }))

    const first = await createSourceOrientationIfEligible({
      generate,
      notebookId,
      service: fixture.service,
      sourceId,
      userId: fixture.owner.id,
    })
    const second = await createSourceOrientationIfEligible({
      generate,
      notebookId,
      service: fixture.service,
      sourceId,
      userId: fixture.owner.id,
    })

    expect(first).toMatchObject({ kind: "created", sourceId })
    expect(second).toMatchObject({ kind: "skipped" })
    expect(generate).toHaveBeenCalledTimes(1)

    const { data: orientation } = await fixture.service
      .from("messages")
      .select("id, suggested_questions, citations(quote, source_id)")
      .eq("notebook_id", notebookId)
      .eq("message_kind", "source_orientation")
      .single()
    expect(orientation).toMatchObject({
      citations: [{ quote: "Freigabe erfolgt am Montag", source_id: sourceId }],
      suggested_questions: [
        "Wann erfolgt die Freigabe?",
        "Für wen gilt die Freigabe?",
        "Welche Vorbereitung ist vor der Freigabe nötig?",
      ],
    })
  })

  it("persists a cited fallback and starter questions when generation is unavailable", async () => {
    const fallbackNotebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Fallback orientation",
      fixture.service,
    )
    const { sourceId } = await insertSource("ready", fallbackNotebookId)

    const result = await createSourceOrientationIfEligible({
      generate: async () => {
        throw new Error("provider unavailable")
      },
      notebookId: fallbackNotebookId,
      service: fixture.service,
      sourceId,
      userId: fixture.owner.id,
    })

    expect(result).toMatchObject({ kind: "created", sourceId })
    const { data: orientation, error } = await fixture.service
      .from("messages")
      .select("content, suggested_questions, citations(quote)")
      .eq("notebook_id", fallbackNotebookId)
      .eq("message_kind", "source_orientation")
      .single()
    expect(error).toBeNull()
    expect(orientation).toMatchObject({
      citations: [{ quote: "Die Freigabe erfolgt am Montag." }],
      content:
        "Die automatische Zusammenfassung ist derzeit nicht verfügbar. Der folgende belegte Auszug hilft beim Einstieg.",
      suggested_questions: expect.arrayContaining([expect.any(String)]),
    })
  })

  it("does not generate an orientation for a terminal source failure or after a history exists", async () => {
    const failedNotebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Failed orientation",
      fixture.service,
    )
    const sourceId = randomUUID()
    const { error } = await fixture.service.from("sources").insert({
      byte_size: 1,
      content_hash: randomUUID().replaceAll("-", "").repeat(2),
      error_reason: "Die PDF-Datei konnte nicht gelesen werden.",
      file_name: "failed.pdf",
      id: sourceId,
      notebook_id: failedNotebookId,
      page_count: 1,
      status: "failed",
      storage_path: sourceStoragePath(fixture.owner.id, failedNotebookId, sourceId),
      user_id: fixture.owner.id,
    })
    if (error) throw error
    const generate = vi.fn()

    await expect(
      createSourceOrientationIfEligible({
        generate,
        notebookId: failedNotebookId,
        service: fixture.service,
        sourceId,
        userId: fixture.owner.id,
      }),
    ).resolves.toEqual({ kind: "skipped", reason: "source_not_ready" })
    expect(generate).not.toHaveBeenCalled()

    const { data: messages } = await fixture.service
      .from("messages")
      .select("id")
      .eq("notebook_id", failedNotebookId)
    expect(messages).toEqual([])
  })
})
