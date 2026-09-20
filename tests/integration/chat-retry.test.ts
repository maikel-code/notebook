import { describe, expect, it } from "vitest"

import { retryFailedAnswer } from "@/lib/rag/retry-answer"

describe("answer retry", () => {
  it("only retries the owner's failed attempt, preserves it, and increments attempt number", async () => {
    const retry = await retryFailedAnswer({
      attempts: [{ attemptNo: 1, id: "failed-answer", status: "failed" }],
      messageId: "failed-answer",
      userId: "owner",
    })
    expect(retry).toEqual({ attemptNo: 2, questionReused: true, status: "streaming" })
  })

  it.each([
    ["foreign", { ownerId: "stranger", status: "failed" }, 404],
    ["missing", null, 404],
    ["non-failed", { ownerId: "owner", status: "complete" }, 422],
  ])("returns the required status for %s retry target", async (_label, target, status) => {
    await expect(retryFailedAnswer({ target, userId: "owner" })).rejects.toMatchObject({ status })
  })
})
