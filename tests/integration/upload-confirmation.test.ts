import { describe, expect, it } from "vitest"

import { verifyUploadedObject } from "@/lib/ingestion/upload"

describe("upload confirmation", () => {
  it("requires matching size and hash", async () => {
    await expect(
      verifyUploadedObject({ byte_size: 1, content_hash: "0".repeat(64) }, null),
    ).rejects.toMatchObject({ status: 422 })
  })
})
