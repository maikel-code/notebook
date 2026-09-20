import { describe, expect, it } from "vitest"

import { assembleSourceText, createSourceOverview } from "@/lib/notebooks/workspace-service"

describe("source detail helpers", () => {
  it("assembles every stored chunk into ordered, page-addressable sections", () => {
    expect(
      assembleSourceText([
        { content: "Abschnitt zwei", ordinal: 2, pageEnd: 2, pageStart: 2 },
        { content: "Abschnitt eins", ordinal: 0, pageEnd: 1, pageStart: 1 },
        { content: "Fortsetzung", ordinal: 1, pageEnd: 1, pageStart: 1 },
      ]),
    ).toEqual([
      { content: "Abschnitt eins\n\nFortsetzung", pageEnd: 1, pageStart: 1 },
      { content: "Abschnitt zwei", pageEnd: 2, pageStart: 2 },
    ])
  })

  it("uses only metadata and a bounded text preview for a neutral overview", () => {
    expect(
      createSourceOverview(
        {
          byteSize: 1200,
          fileName: "Handbuch.pdf",
          pageCount: 2,
          sourceKind: "pdf",
        },
        "Erster gespeicherter Satz. Zweiter gespeicherter Satz.",
      ),
    ).toContain("Erster gespeicherter Satz.")
  })

  it("reports an absent-text state without inventing an overview", () => {
    expect(assembleSourceText([])).toEqual([])
    expect(
      createSourceOverview(
        { byteSize: 0, fileName: "leer.pdf", pageCount: null, sourceKind: "pdf" },
        "",
      ),
    ).toBeNull()
  })
})
