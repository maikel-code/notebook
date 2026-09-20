import { describe, expect, it } from "vitest"

import {
  createFallbackStarterQuestions,
  verifySourceOrientation,
} from "@/lib/rag/source-orientation"

const orientationChunk = {
  chunkId: "chunk-1",
  chunkNumber: 1,
  content: "Die Freigabe erfolgt am Montag im Büro. Die Anmeldung endet am Freitag.",
  pageEnd: 1,
  pageStart: 1,
  sourceId: "source-1",
  sourceName: "Handbuch.pdf",
}

describe("source orientation", () => {
  it("keeps three to five editable starter questions and the verified existing claim citations", () => {
    const questions = createFallbackStarterQuestions("Handbuch.pdf")

    expect(questions).toHaveLength(3)
    expect(new Set(questions).size).toBe(questions.length)
    expect(questions.every((question) => question.trim().endsWith("?"))).toBe(true)
    expect(
      verifySourceOrientation(
        {
          claims: [
            {
              citations: [{ chunkNumber: 1, quote: "Freigabe erfolgt am Montag" }],
              text: "Die Freigabe erfolgt am Montag.",
            },
          ],
          kind: "answer",
        },
        orientationChunk.sourceName,
        questions,
        [orientationChunk],
      ),
    ).toEqual({
      citations: expect.arrayContaining([
        expect.objectContaining({
          quote: "Freigabe erfolgt am Montag",
          sourceId: orientationChunk.sourceId,
        }),
      ]),
      content: "Die Freigabe erfolgt am Montag.",
      kind: "valid",
      suggestedQuestions: questions,
    })
  })

  it("fails closed when a claim is not supported or the starter-question shape is invalid", () => {
    expect(
      verifySourceOrientation(
        {
          claims: [
            {
              citations: [{ chunkNumber: 1, quote: "Freigabe erfolgt am Dienstag" }],
              text: "Die Freigabe erfolgt am Dienstag.",
            },
          ],
          kind: "answer",
        },
        orientationChunk.sourceName,
        createFallbackStarterQuestions(orientationChunk.sourceName),
        [orientationChunk],
      ),
    ).toEqual({ kind: "invalid", reason: "invalid_citations" })

    expect(
      verifySourceOrientation(
        {
          claims: [
            {
              citations: [{ chunkNumber: 1, quote: "Freigabe erfolgt am Montag" }],
              text: "Die Freigabe erfolgt am Montag.",
            },
          ],
          kind: "answer",
        },
        orientationChunk.sourceName,
        ["Nur eine Frage?", "Noch eine Frage?"],
        [orientationChunk],
      ),
    ).toEqual({ kind: "invalid", reason: "invalid_questions" })
  })
})
