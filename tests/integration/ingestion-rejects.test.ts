import { describe, expect, it } from "vitest"

import { validatePdf } from "@/lib/ingestion/validate-pdf"
import { MAX_FILE_BYTES } from "@/lib/limits"

describe("ingestion rejection", () => {
  it("rejects non-PDF, empty, oversized and malformed data without exposing content", async () => {
    await expect(validatePdf(new Uint8Array(), "empty.pdf")).rejects.toMatchObject({ status: 422 })
    await expect(
      validatePdf(new TextEncoder().encode("not a pdf"), "image.png"),
    ).rejects.toMatchObject({
      status: 422,
    })
    await expect(
      validatePdf(new Uint8Array(MAX_FILE_BYTES + 1), "large.pdf"),
    ).rejects.toMatchObject({
      status: 422,
    })
  })
})
