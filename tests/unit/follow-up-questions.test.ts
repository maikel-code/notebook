import { describe, expect, it } from "vitest"

import { normalizeFollowUpQuestions } from "@/lib/rag/follow-up-question-shape"

describe("follow-up questions", () => {
  it("keeps only three to five distinct, usable model suggestions", () => {
    expect(
      normalizeFollowUpQuestions([
        "  Welche Kosten nennt die Quelle?  ",
        "Welche Kosten nennt die Quelle?",
        "Welche Frist ist wichtig?",
        "Was sollte ich als Nächstes prüfen?",
      ]),
    ).toEqual([
      "Welche Kosten nennt die Quelle?",
      "Welche Frist ist wichtig?",
      "Was sollte ich als Nächstes prüfen?",
    ])
    expect(normalizeFollowUpQuestions(["Nur eine Frage?"])).toBeNull()
  })
})
