import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createIntegrationFixture, type IntegrationFixture } from "@/tests/integration/setup"

interface DatabaseErrorResult {
  error: {
    code?: string
    details?: string | null
    message: string
  } | null
}

const applicationTables = [
  "notebooks",
  "sources",
  "ingestion_jobs",
  "chunks",
  "messages",
  "citations",
] as const

function expectForeignKey(result: DatabaseErrorResult, constraint: string) {
  expect(result.error).toMatchObject({ code: "23503" })
  expect(`${result.error?.message}\n${result.error?.details ?? ""}`).toContain(constraint)
}

describe("Database access boundaries", () => {
  let fixture: IntegrationFixture
  let ownerChunkId: string
  let ownerCitationId: string
  let ownerJobId: string
  let ownerNotebookId: string
  let ownerSourceId: string
  let ownerMessageId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    const notebook = await fixture.service
      .from("notebooks")
      .insert({ name: "Owner", user_id: fixture.owner.id })
      .select("id")
      .single()
    if (notebook.error) throw notebook.error
    ownerNotebookId = notebook.data.id

    ownerSourceId = randomUUID()
    const source = await fixture.service.from("sources").insert({
      byte_size: 100,
      content_hash: "a".repeat(64),
      file_name: "owner.pdf",
      id: ownerSourceId,
      notebook_id: ownerNotebookId,
      status: "ready",
      storage_path: `${fixture.owner.id}/${ownerNotebookId}/${ownerSourceId}.pdf`,
      user_id: fixture.owner.id,
    })
    if (source.error) throw source.error

    const job = await fixture.service
      .from("ingestion_jobs")
      .insert({ source_id: ownerSourceId, user_id: fixture.owner.id })
      .select("id")
      .single()
    if (job.error) throw job.error
    ownerJobId = job.data.id

    const chunk = await fixture.service
      .from("chunks")
      .insert({
        char_count: 4,
        content: "text",
        embedding: Array.from({ length: 1536 }, () => 0),
        ordinal: 0,
        page_end: 1,
        page_start: 1,
        source_id: ownerSourceId,
        user_id: fixture.owner.id,
      })
      .select("id")
      .single()
    if (chunk.error) throw chunk.error
    ownerChunkId = chunk.data.id

    const message = await fixture.service
      .from("messages")
      .insert({
        content: "Question",
        notebook_id: ownerNotebookId,
        role: "user",
        selected_sources_snapshot: [],
        status: "complete",
        user_id: fixture.owner.id,
      })
      .select("id")
      .single()
    if (message.error) throw message.error
    ownerMessageId = message.data.id

    const citation = await fixture.service
      .from("citations")
      .insert({
        chunk_id: ownerChunkId,
        message_id: ownerMessageId,
        ordinal: 0,
        page_end: 1,
        page_start: 1,
        quote: "text",
        source_id: ownerSourceId,
        source_name: "owner.pdf",
        user_id: fixture.owner.id,
      })
      .select("id")
      .single()
    if (citation.error) throw citation.error
    ownerCitationId = citation.data.id
  })

  afterAll(async () => fixture.cleanup())

  const validInsertPayloads = {
    notebooks: () => ({ name: "Direct write", user_id: fixture.owner.id }),
    sources: () => {
      const id = randomUUID()
      return {
        byte_size: 100,
        content_hash: "e".repeat(64),
        file_name: "direct.pdf",
        id,
        notebook_id: ownerNotebookId,
        status: "uploading",
        storage_path: `${fixture.owner.id}/${ownerNotebookId}/${id}.pdf`,
        user_id: fixture.owner.id,
      }
    },
    ingestion_jobs: () => ({ source_id: ownerSourceId, user_id: fixture.owner.id }),
    chunks: () => ({
      char_count: 4,
      content: "text",
      embedding: Array.from({ length: 1536 }, () => 0),
      ordinal: 1,
      page_end: 1,
      page_start: 1,
      source_id: ownerSourceId,
      user_id: fixture.owner.id,
    }),
    messages: () => ({
      content: "Question",
      notebook_id: ownerNotebookId,
      role: "user",
      selected_sources_snapshot: [],
      status: "complete",
      user_id: fixture.owner.id,
    }),
    citations: () => ({
      chunk_id: ownerChunkId,
      message_id: ownerMessageId,
      ordinal: 1,
      page_end: 1,
      page_start: 1,
      quote: "text",
      source_id: ownerSourceId,
      source_name: "owner.pdf",
      user_id: fixture.owner.id,
    }),
  } as const

  const validUpdatePayloads = {
    notebooks: { name: "Changed" },
    sources: { status: "processing" },
    ingestion_jobs: { status: "running" },
    chunks: { content: "other", char_count: 5 },
    messages: { content: "Changed" },
    citations: { quote: "other" },
  } as const

  it.each(applicationTables)("blocks valid direct browser operations on %s", async (table) => {
    const ownerRowIds = {
      notebooks: ownerNotebookId,
      sources: ownerSourceId,
      ingestion_jobs: ownerJobId,
      chunks: ownerChunkId,
      messages: ownerMessageId,
      citations: ownerCitationId,
    } as const

    for (const client of [fixture.owner.client, fixture.anonymous]) {
      const select = await client.from(table).select("*").limit(1)
      const insert = await client.from(table).insert(validInsertPayloads[table]() as never)
      const update = await client
        .from(table)
        .update(validUpdatePayloads[table] as never)
        .eq("id", ownerRowIds[table])
      const deletion = await client.from(table).delete().eq("id", ownerRowIds[table])

      expect(select.error).toBeTruthy()
      expect(insert.error).toBeTruthy()
      expect(update.error).toBeTruthy()
      expect(deletion.error).toBeTruthy()
    }
  })

  it("rejects every foreign parent relation by its ownership foreign key", async () => {
    const strangerNotebook = await fixture.service
      .from("notebooks")
      .insert({ name: "Stranger", user_id: fixture.stranger.id })
      .select("id")
      .single()
    if (strangerNotebook.error) throw strangerNotebook.error

    const strangerSourceId = randomUUID()
    const foreignSource = await fixture.service.from("sources").insert({
      byte_size: 100,
      content_hash: "b".repeat(64),
      file_name: "foreign.pdf",
      id: strangerSourceId,
      notebook_id: ownerNotebookId,
      status: "uploading",
      storage_path: `${fixture.stranger.id}/${ownerNotebookId}/${strangerSourceId}.pdf`,
      user_id: fixture.stranger.id,
    })

    const foreignJob = await fixture.service.from("ingestion_jobs").insert({
      source_id: ownerSourceId,
      user_id: fixture.stranger.id,
    })

    const foreignChunk = await fixture.service.from("chunks").insert({
      char_count: 4,
      content: "text",
      embedding: Array.from({ length: 1536 }, () => 0),
      ordinal: 99,
      page_end: 1,
      page_start: 1,
      source_id: ownerSourceId,
      user_id: fixture.stranger.id,
    })

    const foreignMessage = await fixture.service.from("messages").insert({
      content: "Question",
      notebook_id: ownerNotebookId,
      role: "user",
      selected_sources_snapshot: [],
      status: "complete",
      user_id: fixture.stranger.id,
    })

    const strangerMessage = await fixture.service
      .from("messages")
      .insert({
        content: "Stranger question",
        notebook_id: strangerNotebook.data.id,
        role: "user",
        selected_sources_snapshot: [],
        status: "complete",
        user_id: fixture.stranger.id,
      })
      .select("id")
      .single()
    if (strangerMessage.error) throw strangerMessage.error

    const foreignCitationMessage = await fixture.service.from("citations").insert({
      message_id: ownerMessageId,
      ordinal: 99,
      page_end: 1,
      page_start: 1,
      quote: "quote",
      source_name: "source.pdf",
      user_id: fixture.stranger.id,
    })

    const foreignCitationChunk = await fixture.service.from("citations").insert({
      chunk_id: ownerChunkId,
      message_id: strangerMessage.data.id,
      ordinal: 99,
      page_end: 1,
      page_start: 1,
      quote: "quote",
      source_id: ownerSourceId,
      source_name: "source.pdf",
      user_id: fixture.stranger.id,
    })

    const foreignCitationSource = await fixture.service.from("citations").insert({
      message_id: strangerMessage.data.id,
      ordinal: 100,
      page_end: 1,
      page_start: 1,
      quote: "quote",
      source_id: ownerSourceId,
      source_name: "source.pdf",
      user_id: fixture.stranger.id,
    })

    expectForeignKey(foreignSource, "sources_notebook_owner_fk")
    expectForeignKey(foreignJob, "ingestion_jobs_source_owner_fk")
    expectForeignKey(foreignChunk, "chunks_source_owner_fk")
    expectForeignKey(foreignMessage, "messages_notebook_owner_fk")
    expectForeignKey(foreignCitationMessage, "citations_message_owner_fk")
    expectForeignKey(foreignCitationChunk, "citations_chunk_owner_fk")
    expectForeignKey(foreignCitationSource, "citations_source_owner_fk")
  })
})
