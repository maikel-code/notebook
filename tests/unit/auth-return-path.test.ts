import { describe, expect, it } from "vitest"

import { safeNotebookReturnPath } from "@/lib/auth/return-path"

describe("safeNotebookReturnPath", () => {
  it("keeps known notebook paths", () => {
    expect(safeNotebookReturnPath("/notebooks")).toBe("/notebooks")
    expect(safeNotebookReturnPath("/notebooks/550e8400-e29b-41d4-a716-446655440000")).toBe(
      "/notebooks/550e8400-e29b-41d4-a716-446655440000",
    )
  })

  it.each([
    "https://attacker.example/notebooks",
    "//attacker.example/notebooks",
    "/sign-in",
    "/notebooks/../../sign-in",
    "/notebooks/not-a-uuid",
  ])("falls back for unsafe next path %s", (path) => {
    expect(safeNotebookReturnPath(path)).toBe("/notebooks")
  })
})
