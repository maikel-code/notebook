import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { sourceStoragePath } from "@/lib/ingestion/storage"
import { createNotebookForContext } from "@/lib/notebooks/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("workspace source schema and access boundaries", () => {
  let fixture: IntegrationFixture
  let notebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Workspace schema",
      fixture.service,
    )
  })

  afterAll(async () => fixture.cleanup())

  async function insertPdfSource(): Promise<string> {
    const id = randomUUID()
    const { error } = await fixture.service.from("sources").insert({
      byte_size: 1,
      content_hash: randomUUID().replaceAll("-", "").repeat(2),
      file_name: "owner.pdf",
      id,
      notebook_id: notebookId,
      page_count: 1,
      status: "ready",
      storage_path: sourceStoragePath(fixture.owner.id, notebookId, id),
      user_id: fixture.owner.id,
    })
    if (error) throw error
    return id
  }

  async function insertCompleteAnswer(): Promise<string> {
    const question = await fixture.service
      .from("messages")
      .insert({
        content: "Welche Aussage ist belegt?",
        notebook_id: notebookId,
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
        content: "Die Antwort ist vollständig belegt.",
        notebook_id: notebookId,
        question_message_id: question.data.id,
        role: "assistant",
        status: "complete",
        user_id: fixture.owner.id,
      })
      .select("id")
      .single()
    if (answer.error) throw answer.error
    return answer.data.id
  }

  it("enforces the PDF and web source shapes plus canonical web uniqueness", async () => {
    const webSourceId = randomUUID()
    const validWeb = await fixture.service.from("sources").insert({
      byte_size: 100,
      canonical_url: "https://example.test/article",
      content_hash: randomUUID().replaceAll("-", "").repeat(2),
      file_name: "Example article",
      id: webSourceId,
      notebook_id: notebookId,
      origin_url: "https://example.test/article?utm_source=test",
      page_count: 1,
      source_kind: "web",
      status: "processing",
      storage_path: null,
      user_id: fixture.owner.id,
    })
    expect(validWeb.error).toBeNull()

    const invalidWeb = await fixture.service.from("sources").insert({
      byte_size: 100,
      canonical_url: "https://example.test/invalid",
      content_hash: randomUUID().replaceAll("-", "").repeat(2),
      file_name: "Invalid web source",
      id: randomUUID(),
      notebook_id: notebookId,
      origin_url: "https://example.test/invalid",
      page_count: 1,
      source_kind: "web",
      status: "processing",
      storage_path: sourceStoragePath(fixture.owner.id, notebookId, randomUUID()),
      user_id: fixture.owner.id,
    })
    expect(invalidWeb.error).toBeTruthy()

    const duplicateWeb = await fixture.service.from("sources").insert({
      byte_size: 100,
      canonical_url: "https://example.test/article",
      content_hash: randomUUID().replaceAll("-", "").repeat(2),
      file_name: "Duplicate article",
      id: randomUUID(),
      notebook_id: notebookId,
      origin_url: "https://example.test/article",
      page_count: 1,
      source_kind: "web",
      status: "processing",
      storage_path: null,
      user_id: fixture.owner.id,
    })
    expect(duplicateWeb.error).toMatchObject({ code: "23505" })

    const invalidPdf = await fixture.service.from("sources").insert({
      byte_size: 1,
      canonical_url: "https://example.test/pdf",
      content_hash: randomUUID().replaceAll("-", "").repeat(2),
      file_name: "Invalid PDF",
      id: randomUUID(),
      notebook_id: notebookId,
      origin_url: "https://example.test/pdf",
      page_count: 1,
      source_kind: "pdf",
      status: "uploading",
      storage_path: sourceStoragePath(fixture.owner.id, notebookId, randomUUID()),
      user_id: fixture.owner.id,
    })
    expect(invalidPdf.error).toBeTruthy()
  })

  it("enforces one valid orientation shape per notebook", async () => {
    const sourceId = await insertPdfSource()
    const orientation = await fixture.service.from("messages").insert({
      content: "Diese Quelle enthält einen belegten Überblick.",
      message_kind: "source_orientation",
      notebook_id: notebookId,
      orientation_source_id: sourceId,
      role: "assistant",
      status: "complete",
      suggested_questions: ["Frage eins?", "Frage zwei?", "Frage drei?"],
      user_id: fixture.owner.id,
    })
    expect(orientation.error).toBeNull()

    const duplicateOrientation = await fixture.service.from("messages").insert({
      content: "Ein zweiter Überblick.",
      message_kind: "source_orientation",
      notebook_id: notebookId,
      orientation_source_id: sourceId,
      role: "assistant",
      status: "complete",
      suggested_questions: ["Frage eins?", "Frage zwei?", "Frage drei?"],
      user_id: fixture.owner.id,
    })
    expect(duplicateOrientation.error).toMatchObject({ code: "23505" })

    const invalidNotebook = await createNotebookForContext(
      testContext(fixture.owner),
      "Invalid orientation",
      fixture.service,
    )
    const invalidSourceId = randomUUID()
    const invalidSource = await fixture.service.from("sources").insert({
      byte_size: 1,
      content_hash: randomUUID().replaceAll("-", "").repeat(2),
      file_name: "invalid.pdf",
      id: invalidSourceId,
      notebook_id: invalidNotebook,
      page_count: 1,
      status: "ready",
      storage_path: sourceStoragePath(fixture.owner.id, invalidNotebook, invalidSourceId),
      user_id: fixture.owner.id,
    })
    if (invalidSource.error) throw invalidSource.error
    const invalidOrientation = await fixture.service.from("messages").insert({
      content: "Zu wenige Fragen.",
      message_kind: "source_orientation",
      notebook_id: invalidNotebook,
      orientation_source_id: invalidSourceId,
      role: "assistant",
      status: "complete",
      suggested_questions: ["Nur eine?", "Nur zwei?"],
      user_id: fixture.owner.id,
    })
    expect(invalidOrientation.error).toBeTruthy()
  })

  it("keeps studio notes immutable and unavailable to browser roles", async () => {
    const messageId = await insertCompleteAnswer()
    const note = await fixture.service
      .from("studio_notes")
      .insert({
        content_snapshot: "Die Antwort ist vollständig belegt.",
        message_id: messageId,
        notebook_id: notebookId,
        title: "Welche Aussage ist belegt?",
        user_id: fixture.owner.id,
      })
      .select("id")
      .single()
    if (note.error) throw note.error

    const duplicate = await fixture.service.from("studio_notes").insert({
      content_snapshot: "Doppelte Notiz.",
      message_id: messageId,
      notebook_id: notebookId,
      title: "Doppelt",
      user_id: fixture.owner.id,
    })
    expect(duplicate.error).toMatchObject({ code: "23505" })

    for (const client of [fixture.owner.client, fixture.stranger.client, fixture.anonymous]) {
      const select = await client.from("studio_notes").select("*").eq("id", note.data.id)
      const update = await client
        .from("studio_notes")
        .update({ title: "Manipuliert" })
        .eq("id", note.data.id)
      const deletion = await client.from("studio_notes").delete().eq("id", note.data.id)

      expect(select.error).toBeTruthy()
      expect(update.error).toBeTruthy()
      expect(deletion.error).toBeTruthy()
    }
  })
})
