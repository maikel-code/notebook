import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { sourceStoragePath } from "@/lib/ingestion/storage"
import {
  confirmUploadForContext,
  prepareUploadForContext,
  verifyUploadedObject,
} from "@/lib/ingestion/upload"
import { createNotebookForContext } from "@/lib/notebooks/service"
import { sha256Hex } from "@/lib/upload/hash"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("upload confirmation", () => {
  let fixture: IntegrationFixture
  let notebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Confirmation",
      fixture.service,
    )
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

  async function expectUploading(sourceId: string): Promise<void> {
    const { data, error } = await fixture.service
      .from("sources")
      .select("status")
      .eq("id", sourceId)
      .single()
    if (error) throw error
    expect(data.status).toBe("uploading")
  }

  it("requires matching size and hash", async () => {
    await expect(
      verifyUploadedObject({ byte_size: 1, content_hash: "0".repeat(64) }, null),
    ).rejects.toMatchObject({ status: 422 })
  })

  it("rejects missing storage plus mismatched size and hash before changing source state", async () => {
    const missing = await prepareUploadForContext(
      testContext(fixture.owner),
      {
        byteSize: 1,
        contentHash: "0".repeat(64),
        fileName: "missing.pdf",
        notebookId,
      },
      fixture.service,
    )
    if (missing.decision !== "ok") throw new Error("Expected upload draft")
    await expect(
      confirmUploadForContext(testContext(fixture.owner), missing.sourceId, fixture.service),
    ).rejects.toMatchObject({ status: 422 })
    await expectUploading(missing.sourceId)

    const mismatch = await prepareUploadForContext(
      testContext(fixture.owner),
      {
        byteSize: 1,
        contentHash: "1".repeat(64),
        fileName: "mismatch.pdf",
        notebookId,
      },
      fixture.service,
    )
    if (mismatch.decision !== "ok") throw new Error("Expected upload draft")
    const { error: uploadError } = await fixture.owner.client.storage
      .from("sources")
      .upload(mismatch.storagePath, new Blob(["two"], { type: "application/pdf" }), {
        contentType: "application/pdf",
      })
    if (uploadError) throw uploadError
    await expect(
      confirmUploadForContext(testContext(fixture.owner), mismatch.sourceId, fixture.service),
    ).rejects.toMatchObject({ status: 422 })
    await expectUploading(mismatch.sourceId)

    const hashMismatch = await prepareUploadForContext(
      testContext(fixture.owner),
      {
        byteSize: 1,
        contentHash: "2".repeat(64),
        fileName: "hash-mismatch.pdf",
        notebookId,
      },
      fixture.service,
    )
    if (hashMismatch.decision !== "ok") throw new Error("Expected upload draft")
    const { error: hashUploadError } = await fixture.owner.client.storage
      .from("sources")
      .upload(hashMismatch.storagePath, new Blob(["x"], { type: "application/pdf" }), {
        contentType: "application/pdf",
      })
    if (hashUploadError) throw hashUploadError
    await expect(
      confirmUploadForContext(testContext(fixture.owner), hashMismatch.sourceId, fixture.service),
    ).rejects.toMatchObject({ status: 422 })
    await expectUploading(hashMismatch.sourceId)
  })

  it("atomically switches a verified duplicate replacement and creates exactly one job", async () => {
    const oldSourceId = crypto.randomUUID()
    const bytes = validPdf()
    const hash = await sha256Hex(bytes)
    const { error: sourceError } = await fixture.service.from("sources").insert({
      byte_size: bytes.byteLength,
      content_hash: hash,
      file_name: "old.pdf",
      id: oldSourceId,
      notebook_id: notebookId,
      status: "ready",
      storage_path: sourceStoragePath(fixture.owner.id, notebookId, oldSourceId),
      user_id: fixture.owner.id,
    })
    if (sourceError) throw sourceError
    const replacement = await prepareUploadForContext(
      testContext(fixture.owner),
      {
        byteSize: bytes.byteLength,
        contentHash: hash,
        fileName: "replacement.pdf",
        intent: "replace",
        notebookId,
        replaceSourceId: oldSourceId,
      },
      fixture.service,
    )
    if (replacement.decision !== "ok") throw new Error("Expected replacement draft")
    const { error: uploadError } = await fixture.owner.client.storage
      .from("sources")
      .upload(replacement.storagePath, new Blob([bytes], { type: "application/pdf" }), {
        contentType: "application/pdf",
      })
    if (uploadError) throw uploadError
    await confirmUploadForContext(testContext(fixture.owner), replacement.sourceId, fixture.service)
    await confirmUploadForContext(testContext(fixture.owner), replacement.sourceId, fixture.service)
    const { data: sources, error: sourcesError } = await fixture.service
      .from("sources")
      .select("id, status, cleanup_storage_path")
      .in("id", [oldSourceId, replacement.sourceId])
    if (sourcesError) throw sourcesError
    expect(sources).toEqual([
      expect.objectContaining({
        cleanup_storage_path: sourceStoragePath(fixture.owner.id, notebookId, oldSourceId),
        id: replacement.sourceId,
        status: "processing",
      }),
    ])
    const { count, error: jobsError } = await fixture.service
      .from("ingestion_jobs")
      .select("id", { count: "exact", head: true })
      .eq("source_id", replacement.sourceId)
      .eq("user_id", fixture.owner.id)
    if (jobsError) throw jobsError
    expect(count).toBe(1)
  })
})
