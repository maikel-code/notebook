import { describe, expect, it } from "vitest"

import { runChatAttempt } from "@/lib/rag/chat-attempt"

describe("chat terminal states", () => {
  it.each([
    ["answer provider", { answerProvider: new Error("provider unavailable") }],
    ["question embedding", { questionEmbedding: new Error("embedding unavailable") }],
    ["retrieval", { retrieval: new Error("search unavailable") }],
  ])("stores %s failure neutrally and permits retry", async (_label, failures) => {
    await expect(runChatAttempt({ failures })).resolves.toMatchObject({
      citations: [],
      content: expect.stringMatching(/erneut versuchen/i),
      status: "failed",
    })
  })

  it("discards provisional content on abort and releases the notebook lock", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(runChatAttempt({ signal: controller.signal })).resolves.toMatchObject({
      citations: [],
      content: expect.stringMatching(/abgebrochen/i),
      status: "aborted",
    })
  })

  it("rejects a second question and source or notebook deletion while streaming", async () => {
    await expect(runChatAttempt({ whileStreaming: "question" })).rejects.toMatchObject({
      status: 409,
    })
    await expect(runChatAttempt({ whileStreaming: "delete-source" })).rejects.toMatchObject({
      status: 409,
    })
    await expect(runChatAttempt({ whileStreaming: "delete-notebook" })).rejects.toMatchObject({
      status: 409,
    })
  })
})
