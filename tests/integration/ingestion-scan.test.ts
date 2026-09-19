import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { runNextIngestionJob } from "@/lib/ingestion/run-job"
import { sourceStoragePath } from "@/lib/ingestion/storage"
import { createNotebookForContext } from "@/lib/notebooks/service"
import { sha256Hex } from "@/lib/upload/hash"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("scan ingestion", () => {
  let fixture: IntegrationFixture

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
  })

  afterAll(async () => fixture.cleanup())

  it("marks a textless PDF unusable and never ready", async () => {
    const notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Scan",
      fixture.service,
    )
    const sourceId = crypto.randomUUID()
    const bytes = new TextEncoder().encode(`%PDF-1.4
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
    const path = sourceStoragePath(fixture.owner.id, notebookId, sourceId)
    const { error: uploadError } = await fixture.owner.client.storage
      .from("sources")
      .upload(path, new Blob([bytes], { type: "application/pdf" }), {
        contentType: "application/pdf",
      })
    if (uploadError) throw uploadError
    const { error: sourceError } = await fixture.service.from("sources").insert({
      byte_size: bytes.byteLength,
      content_hash: await sha256Hex(bytes),
      file_name: "scan.pdf",
      id: sourceId,
      notebook_id: notebookId,
      status: "processing",
      storage_path: path,
      user_id: fixture.owner.id,
    })
    if (sourceError) throw sourceError
    const { error: jobError } = await fixture.service.from("ingestion_jobs").insert({
      source_id: sourceId,
      status: "queued",
      user_id: fixture.owner.id,
    })
    if (jobError) throw jobError
    await expect(runNextIngestionJob(fixture.service, sourceId)).resolves.toBe(true)
    const { data, error } = await fixture.service
      .from("sources")
      .select("status")
      .eq("id", sourceId)
      .single()
    if (error) throw error
    expect(data.status).toBe("unusable")
  })
})
