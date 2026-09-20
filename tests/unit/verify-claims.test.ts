import { describe, expect, it } from "vitest"

import { verifyClaims } from "@/lib/rag/verify-claims"

const selectedChunk = {
  chunkId: "chunk-1",
  chunkNumber: 1,
  content: "Die Freigabe erfolgt am Montag im Büro.",
  pageEnd: 1,
  pageStart: 1,
  sourceId: "source-1",
  sourceName: "Handbuch.pdf",
}

describe("claim verification", () => {
  it("accepts a one-line claim with a literal quote from a retrieved selected chunk", () => {
    expect(
      verifyClaims(
        {
          kind: "answer",
          claims: [
            {
              citations: [{ chunkNumber: 1, quote: "Freigabe erfolgt am Montag" }],
              text: "Die Freigabe erfolgt am Montag.",
            },
          ],
        },
        [selectedChunk],
      ),
    ).toEqual({ kind: "valid", citations: expect.any(Array), claims: expect.any(Array) })
  })

  it.each([
    ["unknown chunk", { chunkNumber: 2, quote: "Freigabe erfolgt am Montag" }],
    ["non-literal quote", { chunkNumber: 1, quote: "Freigabe erfolgt am Dienstag" }],
    ["missing citation", undefined],
  ])("rejects %s", (_label, citation) => {
    const citations = citation ? [citation] : []
    expect(
      verifyClaims(
        { kind: "answer", claims: [{ citations, text: "Die Freigabe erfolgt am Montag." }] },
        [selectedChunk],
      ),
    ).toEqual({ kind: "invalid", reason: "invalid_citations" })
  })

  it("rejects an otherwise known chunk when it was not retrieved from a selected source", () => {
    expect(
      verifyClaims(
        {
          kind: "answer",
          claims: [
            {
              citations: [{ chunkNumber: 1, quote: "Freigabe erfolgt am Montag" }],
              text: "Die Freigabe erfolgt am Montag.",
            },
          ],
        },
        [{ ...selectedChunk, sourceId: "unselected-source", selected: false }],
      ),
    ).toEqual({ kind: "invalid", reason: "invalid_citations" })
  })

  it("fails closed for the complete draft when one of several claims is invalid", () => {
    expect(
      verifyClaims(
        {
          kind: "answer",
          claims: [
            {
              citations: [{ chunkNumber: 1, quote: "Freigabe erfolgt am Montag" }],
              text: "Die Freigabe erfolgt am Montag.",
            },
            {
              citations: [{ chunkNumber: 1, quote: "erfundener Wortlaut" }],
              text: "Diese Aussage ist nicht belegt.",
            },
          ],
        },
        [selectedChunk],
      ),
    ).toEqual({ kind: "invalid", reason: "invalid_citations" })
  })
})
