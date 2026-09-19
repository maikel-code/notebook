import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { deleteNotebookForContext } from "@/lib/notebooks/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("Notebook deletion cascade", () => {
  let fixture: IntegrationFixture
  let notebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    const notebook = await fixture.service
      .from("notebooks")
      .insert({ name: "Cascade", user_id: fixture.owner.id })
      .select("id")
      .single()
    if (notebook.error) throw notebook.error
    notebookId = notebook.data.id

    const sourceId = randomUUID()
    const source = await fixture.service.from("sources").insert({
      byte_size: 100,
      content_hash: "c".repeat(64),
      file_name: "cascade.pdf",
      id: sourceId,
      notebook_id: notebookId,
      status: "ready",
      storage_path: `${fixture.owner.id}/${notebookId}/${sourceId}.pdf`,
      user_id: fixture.owner.id,
    })
    if (source.error) throw source.error

    const job = await fixture.service.from("ingestion_jobs").insert({
      source_id: sourceId,
      status: "succeeded",
      user_id: fixture.owner.id,
    })
    if (job.error) throw job.error

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
        notebook_id: notebookId,
        role: "user",
        selected_sources_snapshot: [{ id: sourceId, name: "cascade.pdf" }],
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
        notebook_id: notebookId,
        question_message_id: question.data.id,
        role: "assistant",
        status: "complete",
        user_id: fixture.owner.id,
      })
      .select("id")
      .single()
    if (answer.error) throw answer.error

    const citation = await fixture.service.from("citations").insert({
      chunk_id: chunk.data.id,
      message_id: answer.data.id,
      ordinal: 0,
      page_end: 1,
      page_start: 1,
      quote: "text",
      source_id: sourceId,
      source_name: "cascade.pdf",
      user_id: fixture.owner.id,
    })
    if (citation.error) throw citation.error
  })

  afterAll(async () => fixture.cleanup())

  it("deletes every database child row", async () => {
    await deleteNotebookForContext(testContext(fixture.owner), notebookId, true, fixture.service)

    for (const table of [
      "notebooks",
      "sources",
      "ingestion_jobs",
      "chunks",
      "messages",
      "citations",
    ]) {
      const { count, error } = await fixture.service
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", fixture.owner.id)
      expect(error).toBeNull()
      expect(count).toBe(0)
    }
  })
})
