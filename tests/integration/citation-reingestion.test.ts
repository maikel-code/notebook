import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createIntegrationFixture, type IntegrationFixture } from "@/tests/integration/setup"

describe("Citation retention during source re-ingestion", () => {
  let fixture: IntegrationFixture

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
  })

  afterAll(async () => fixture.cleanup())

  it("keeps the source reference when a cited chunk is replaced", async () => {
    const notebook = await fixture.service
      .from("notebooks")
      .insert({ name: "Re-ingestion", user_id: fixture.owner.id })
      .select("id")
      .single()
    if (notebook.error) throw notebook.error

    const sourceId = randomUUID()
    const source = await fixture.service.from("sources").insert({
      byte_size: 100,
      content_hash: "d".repeat(64),
      file_name: "re-ingestion.pdf",
      id: sourceId,
      notebook_id: notebook.data.id,
      status: "ready",
      storage_path: `${fixture.owner.id}/${notebook.data.id}/${sourceId}.pdf`,
      user_id: fixture.owner.id,
    })
    if (source.error) throw source.error

    const chunk = await fixture.service
      .from("chunks")
      .insert({
        char_count: 4,
        content: "text",
        embedding: Array.from({ length: 1536 }, () => 0),
        ordinal: 0,
        page_end: 1,
        page_start: 1,
        source_id: sourceId,
        user_id: fixture.owner.id,
      })
      .select("id")
      .single()
    if (chunk.error) throw chunk.error

    const question = await fixture.service
      .from("messages")
      .insert({
        content: "Question",
        notebook_id: notebook.data.id,
        role: "user",
        selected_sources_snapshot: [],
        status: "complete",
        user_id: fixture.owner.id,
      })
      .select("id")
      .single()
    if (question.error) throw question.error

    const answer = await fixture.service
      .from("messages")
      .insert({
        attempt_no: 1,
        content: "Answer",
        notebook_id: notebook.data.id,
        question_message_id: question.data.id,
        role: "assistant",
        status: "complete",
        user_id: fixture.owner.id,
      })
      .select("id")
      .single()
    if (answer.error) throw answer.error

    const citation = await fixture.service
      .from("citations")
      .insert({
        chunk_id: chunk.data.id,
        message_id: answer.data.id,
        ordinal: 0,
        page_end: 1,
        page_start: 1,
        quote: "text",
        source_id: sourceId,
        source_name: "re-ingestion.pdf",
        user_id: fixture.owner.id,
      })
      .select("id")
      .single()
    if (citation.error) throw citation.error

    const deletion = await fixture.service.from("chunks").delete().eq("id", chunk.data.id)
    expect(deletion.error).toBeNull()

    const persistedCitation = await fixture.service
      .from("citations")
      .select("chunk_id, source_id")
      .eq("id", citation.data.id)
      .single()
    expect(persistedCitation.error).toBeNull()
    expect(persistedCitation.data).toEqual({ chunk_id: null, source_id: sourceId })

    const sourceDeletion = await fixture.service.from("sources").delete().eq("id", sourceId)
    expect(sourceDeletion.error).toBeNull()

    const historicalCitation = await fixture.service
      .from("citations")
      .select("chunk_id, source_id")
      .eq("id", citation.data.id)
      .single()
    expect(historicalCitation.error).toBeNull()
    expect(historicalCitation.data).toEqual({ chunk_id: null, source_id: null })
  })
})
