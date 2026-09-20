import { describe, expect, it } from "vitest"

import { createStudioNoteTitle, isSaveableStudioAnswer } from "@/lib/studio/service"

describe("studio notes", () => {
  it("uses the answered question as a stable, bounded title", () => {
    expect(createStudioNoteTitle("  Welche   Kosten   fallen an?  ")).toBe(
      "Welche Kosten fallen an?",
    )
    expect(createStudioNoteTitle("x".repeat(201))).toHaveLength(200)
  })

  it("only permits fully verified answers to be saved", () => {
    expect(
      isSaveableStudioAnswer({
        citations: [{ id: "citation" }],
        messageKind: "answer",
        role: "assistant",
        status: "complete",
        unsupportedReason: null,
      }),
    ).toBe(true)
    expect(
      isSaveableStudioAnswer({
        citations: [],
        messageKind: "answer",
        role: "assistant",
        status: "complete",
        unsupportedReason: null,
      }),
    ).toBe(false)
  })
})
