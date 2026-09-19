import { describe, expect, it } from "vitest"

import { chunkExtractedPages } from "@/lib/ingestion/chunk"

describe("scan ingestion", () => {
  it("does not create chunks for pages without extractable text", () => {
    expect(chunkExtractedPages([{ page: 1, text: "   " }])).toEqual([])
  })
})
