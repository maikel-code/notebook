import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createIntegrationFixture, type IntegrationFixture } from "@/tests/integration/setup"

const applicationTables = [
  "notebooks",
  "sources",
  "ingestion_jobs",
  "chunks",
  "messages",
  "citations",
] as const

describe("Database access boundaries", () => {
  let fixture: IntegrationFixture
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
  })

  afterAll(async () => fixture.cleanup())

  it.each(applicationTables)("blocks all direct browser operations on %s", async (table) => {
    for (const client of [fixture.owner.client, fixture.anonymous]) {
      const select = await client.from(table).select("*").limit(1)
      const insert = await client.from(table).insert({})
      const update = await client
        .from(table)
        .update({ user_id: fixture.owner.id })
        .eq("id", randomUUID())
      const deletion = await client.from(table).delete().eq("id", randomUUID())

      expect(select.error).toBeTruthy()
      expect(insert.error).toBeTruthy()
      expect(update.error).toBeTruthy()
      expect(deletion.error).toBeTruthy()
    }
  })

  it("rejects every foreign parent relation even with the caller's own user_id", async () => {
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
      ordinal: 0,
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

    const foreignCitation = await fixture.service.from("citations").insert({
      message_id: ownerMessageId,
      ordinal: 0,
      page_end: 1,
      page_start: 1,
      quote: "quote",
      source_name: "source.pdf",
      user_id: fixture.stranger.id,
    })

    expect(foreignSource.error).toBeTruthy()
    expect(foreignJob.error).toBeTruthy()
    expect(foreignChunk.error).toBeTruthy()
    expect(foreignMessage.error).toBeTruthy()
    expect(foreignCitation.error).toBeTruthy()
  })
})
