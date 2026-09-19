import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { sourceStoragePath } from "@/lib/ingestion/storage"
import { parseUploadIntent, prepareUploadForContext } from "@/lib/ingestion/upload"
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
})
