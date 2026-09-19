import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { sourceStoragePath } from "@/lib/ingestion/storage"
import { confirmUploadForContext, prepareUploadForContext } from "@/lib/ingestion/upload"
import { createNotebookForContext } from "@/lib/notebooks/service"
import { sha256Hex } from "@/lib/upload/hash"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("ingestion review regressions", () => {
  let fixture: IntegrationFixture

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
  })

  afterAll(async () => fixture.cleanup())

  const validPdf = () =>
    new TextEncoder().encode(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`)

  it("rejects a replacement atomically while the notebook has a streaming response", async () => {
    const notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Streaming replacement",
      fixture.service,
    )
    const oldSourceId = crypto.randomUUID()
    const bytes = validPdf()
    const hash = await sha256Hex(bytes)
    const { error: sourcesError } = await fixture.service.from("sources").insert({
      byte_size: bytes.byteLength,
      content_hash: hash,
      file_name: "old.pdf",
      id: oldSourceId,
      notebook_id: notebookId,
      status: "ready",
      storage_path: sourceStoragePath(fixture.owner.id, notebookId, oldSourceId),
      user_id: fixture.owner.id,
    })
    if (sourcesError) throw sourcesError
    const draft = await prepareUploadForContext(
      testContext(fixture.owner),
      {
        byteSize: bytes.byteLength,
        contentHash: hash,
        fileName: "draft.pdf",
        intent: "replace",
        notebookId,
        replaceSourceId: oldSourceId,
      },
      fixture.service,
    )
    if (draft.decision !== "ok") throw new Error("Expected replacement draft")
    const { error: uploadError } = await fixture.owner.client.storage
      .from("sources")
      .upload(draft.storagePath, new Blob([bytes], { type: "application/pdf" }), {
        contentType: "application/pdf",
      })
    if (uploadError) throw uploadError
    const { data: question, error: questionError } = await fixture.service
      .from("messages")
      .insert({
        content: "Question",
        notebook_id: notebookId,
        role: "user",
        selected_sources_snapshot: [],
        status: "complete",
        user_id: fixture.owner.id,
      })
      .select("id")
      .single()
    if (questionError) throw questionError
    const { error: streamingError } = await fixture.service.from("messages").insert({
      attempt_no: 1,
      content: "",
      notebook_id: notebookId,
      question_message_id: question.id,
      role: "assistant",
      status: "streaming",
      user_id: fixture.owner.id,
    })
    if (streamingError) throw streamingError

    await expect(
      confirmUploadForContext(testContext(fixture.owner), draft.sourceId, fixture.service),
    ).rejects.toMatchObject({ status: 409 })
    const { data: sources, error: checkError } = await fixture.service
      .from("sources")
      .select("id, status")
      .in("id", [oldSourceId, draft.sourceId])
      .order("id")
    if (checkError) throw checkError
    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: oldSourceId, status: "ready" }),
        expect.objectContaining({ id: draft.sourceId, status: "uploading" }),
      ]),
    )
    const { count: jobs, error: jobsError } = await fixture.service
      .from("ingestion_jobs")
      .select("id", { count: "exact", head: true })
      .eq("source_id", draft.sourceId)
    if (jobsError) throw jobsError
    expect(jobs).toBe(0)
  })

  it("serializes competing prepare calls at the 30-source limit", async () => {
    const notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Concurrent limit",
      fixture.service,
    )
    const sources = Array.from({ length: 29 }, (_, index) => {
      const id = crypto.randomUUID()
      return {
        byte_size: 1,
        content_hash: index.toString(16).padStart(64, "0"),
        file_name: `${index}.pdf`,
        id,
        notebook_id: notebookId,
        status: "ready",
        storage_path: sourceStoragePath(fixture.owner.id, notebookId, id),
        user_id: fixture.owner.id,
      }
    })
    const { error: seedError } = await fixture.service.from("sources").insert(sources)
    if (seedError) throw seedError
    const input = (suffix: string) => ({
      byteSize: 1,
      contentHash: `${"f".repeat(63)}${suffix}`,
      fileName: `${suffix}.pdf`,
      notebookId,
    })
    const outcomes = await Promise.all([
      prepareUploadForContext(testContext(fixture.owner), input("1"), fixture.service),
      prepareUploadForContext(testContext(fixture.owner), input("2"), fixture.service),
    ])
    expect(outcomes.filter((outcome) => outcome.decision === "ok")).toHaveLength(1)
    const { count, error: countError } = await fixture.service
      .from("sources")
      .select("id", { count: "exact", head: true })
      .eq("notebook_id", notebookId)
    if (countError) throw countError
    expect(count).toBe(30)
  })

  it("permits a replacement draft at the full limit while rejecting a parallel addition", async () => {
    const notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Full replacement limit",
      fixture.service,
    )
    const sources = Array.from({ length: 30 }, (_, index) => {
      const id = crypto.randomUUID()
      return {
        byte_size: 1,
        content_hash: index.toString(16).padStart(64, "0"),
        file_name: `${index}.pdf`,
        id,
        notebook_id: notebookId,
        status: "ready",
        storage_path: sourceStoragePath(fixture.owner.id, notebookId, id),
        user_id: fixture.owner.id,
      }
    })
    const { error: seedError } = await fixture.service.from("sources").insert(sources)
    if (seedError) throw seedError
    const [addition, replacement] = await Promise.all([
      prepareUploadForContext(
        testContext(fixture.owner),
        {
          byteSize: 1,
          contentHash: "e".repeat(64),
          fileName: "addition.pdf",
          notebookId,
        },
        fixture.service,
      ),
      prepareUploadForContext(
        testContext(fixture.owner),
        {
          byteSize: 1,
          contentHash: "0".repeat(64),
          fileName: "replacement.pdf",
          intent: "replace",
          notebookId,
          replaceSourceId: sources[0]?.id,
        },
        fixture.service,
      ),
    ])
    expect(addition).toMatchObject({ decision: "rejected" })
    expect(replacement).toMatchObject({ decision: "ok" })
    const { data: activeSources, error: activeSourcesError } = await fixture.service
      .from("sources")
      .select("id")
      .eq("notebook_id", notebookId)
      .is("replaces_source_id", null)
    if (activeSourcesError) throw activeSourcesError
    expect(activeSources).toHaveLength(30)
  })
})
