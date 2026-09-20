import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { sourceStoragePath } from "@/lib/ingestion/storage"
import {
  cancelUploadForContext,
  parseUploadIntent,
  prepareUploadForContext,
} from "@/lib/ingestion/upload"
import { createNotebookForContext } from "@/lib/notebooks/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("upload replacement", () => {
  let fixture: IntegrationFixture
  let notebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Uploads",
      fixture.service,
    )
  })

  afterAll(async () => fixture.cleanup())

  it("only permits add and replace intents", () => {
    expect(parseUploadIntent(undefined)).toBe("add")
    expect(parseUploadIntent("replace")).toBe("replace")
    expect(() => parseUploadIntent("delete")).toThrow("Upload-Entscheidung")
  })

  it("enforces the owner context and presents duplicate options before writing another source", async () => {
    const input = {
      byteSize: 12,
      contentHash: "a".repeat(64),
      fileName: "source.pdf",
      notebookId,
    }
    const prepared = await prepareUploadForContext(
      testContext(fixture.owner),
      input,
      fixture.service,
    )
    expect(prepared.decision).toBe("ok")
    await expect(
      prepareUploadForContext(testContext(fixture.stranger), input, fixture.service),
    ).rejects.toMatchObject({ status: 404 })
    await expect(prepareUploadForContext(null, input, fixture.service)).rejects.toMatchObject({
      status: 401,
    })
    await expect(
      prepareUploadForContext(testContext(fixture.owner), input, fixture.service),
    ).resolves.toMatchObject({ decision: "duplicate" })
  })

  it("rejects the 31st additional source but permits a replacement draft", async () => {
    const limitNotebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Source limit",
      fixture.service,
    )
    const rows = Array.from({ length: 30 }, (_, index) => {
      const id = crypto.randomUUID()
      return {
        byte_size: 1,
        content_hash: index.toString(16).padStart(64, "0"),
        file_name: `${index}.pdf`,
        id,
        notebook_id: limitNotebookId,
        status: "ready",
        storage_path: sourceStoragePath(fixture.owner.id, limitNotebookId, id),
        user_id: fixture.owner.id,
      }
    })
    const { error } = await fixture.service.from("sources").insert(rows)
    if (error) throw error
    await expect(
      prepareUploadForContext(
        testContext(fixture.owner),
        {
          byteSize: 1,
          contentHash: "f".repeat(64),
          fileName: "limit.pdf",
          notebookId: limitNotebookId,
        },
        fixture.service,
      ),
    ).resolves.toMatchObject({ decision: "rejected" })
    await expect(
      prepareUploadForContext(
        testContext(fixture.owner),
        {
          byteSize: 1,
          contentHash: "0".repeat(64),
          fileName: "replace.pdf",
          intent: "replace",
          notebookId: limitNotebookId,
          replaceSourceId: rows[0]?.id,
        },
        fixture.service,
      ),
    ).resolves.toMatchObject({ decision: "ok" })
  })

  it("cancels only an upload draft and keeps a processing file intact", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4")
    const draft = await prepareUploadForContext(
      testContext(fixture.owner),
      {
        byteSize: bytes.byteLength,
        contentHash: "c".repeat(64),
        fileName: "cancel.pdf",
        notebookId,
      },
      fixture.service,
    )
    if (draft.decision !== "ok") throw new Error("Expected upload draft")
    const { error: uploadError } = await fixture.owner.client.storage
      .from("sources")
      .upload(draft.storagePath, new Blob([bytes], { type: "application/pdf" }), {
        contentType: "application/pdf",
      })
    if (uploadError) throw uploadError

    await cancelUploadForContext(testContext(fixture.owner), draft.sourceId, fixture.service)
    await expect(
      fixture.service.from("sources").select("id").eq("id", draft.sourceId).maybeSingle(),
    ).resolves.toMatchObject({ data: null })

    const processing = await prepareUploadForContext(
      testContext(fixture.owner),
      {
        byteSize: bytes.byteLength,
        contentHash: "d".repeat(64),
        fileName: "processing.pdf",
        notebookId,
      },
      fixture.service,
    )
    if (processing.decision !== "ok") throw new Error("Expected processing draft")
    const { error: processingUploadError } = await fixture.owner.client.storage
      .from("sources")
      .upload(processing.storagePath, new Blob([bytes], { type: "application/pdf" }), {
        contentType: "application/pdf",
      })
    if (processingUploadError) throw processingUploadError
    const { error: processingError } = await fixture.service
      .from("sources")
      .update({ status: "processing" })
      .eq("id", processing.sourceId)
    if (processingError) throw processingError

    await expect(
      cancelUploadForContext(testContext(fixture.owner), processing.sourceId, fixture.service),
    ).rejects.toMatchObject({ status: 422 })
    await expect(
      fixture.owner.client.storage.from("sources").download(processing.storagePath),
    ).resolves.toMatchObject({ error: null })
  })
})
