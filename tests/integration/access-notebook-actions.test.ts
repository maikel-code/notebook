import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  createNotebookForContext,
  deleteNotebookForContext,
  getNotebookForContext,
  renameNotebookForContext,
} from "@/lib/notebooks/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("Notebook actions access matrix", () => {
  let fixture: IntegrationFixture
  let matrixNotebookId: string
  let ownerNotebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    ownerNotebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Owner",
      fixture.service,
    )
    matrixNotebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Access matrix",
      fixture.service,
    )
  })

  afterAll(async () => fixture.cleanup())

  it("creates a notebook only for the current user", async () => {
    const strangerNotebookId = await createNotebookForContext(
      testContext(fixture.stranger),
      "Stranger",
      fixture.service,
    )
    const notebook = await getNotebookForContext(
      testContext(fixture.stranger),
      strangerNotebookId,
      fixture.service,
    )
    expect(notebook.user_id).toBe(fixture.stranger.id)
    await expect(
      createNotebookForContext(null, "Anonymous", fixture.service),
    ).rejects.toMatchObject({
      status: 401,
    })
  })

  it("renames and deletes an owned notebook", async () => {
    await renameNotebookForContext(
      testContext(fixture.owner),
      ownerNotebookId,
      "Renamed",
      fixture.service,
    )
    await expect(
      getNotebookForContext(testContext(fixture.owner), ownerNotebookId, fixture.service),
    ).resolves.toMatchObject({ name: "Renamed" })

    await deleteNotebookForContext(
      testContext(fixture.owner),
      ownerNotebookId,
      true,
      fixture.service,
    )
    await expect(
      getNotebookForContext(testContext(fixture.owner), ownerNotebookId, fixture.service),
    ).rejects.toMatchObject({ status: 404 })
  })

  it.each([
    ["foreign rename", "rename", () => testContext(fixture.stranger), () => matrixNotebookId],
    ["missing rename", "rename", () => testContext(fixture.owner), randomUUID],
    ["anonymous rename", "rename", () => null, () => matrixNotebookId],
    ["foreign delete", "delete", () => testContext(fixture.stranger), () => matrixNotebookId],
    ["missing delete", "delete", () => testContext(fixture.owner), randomUUID],
    ["anonymous delete", "delete", () => null, () => matrixNotebookId],
  ])("rejects %s", async (_label, operation, context, id) => {
    const expectedStatus = context() ? 404 : 401
    const result =
      operation === "rename"
        ? renameNotebookForContext(context(), id(), "Nope", fixture.service)
        : deleteNotebookForContext(context(), id(), true, fixture.service)
    await expect(result).rejects.toMatchObject({ status: expectedStatus })
  })

  it("requires explicit deletion confirmation", async () => {
    const notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Keep me",
      fixture.service,
    )
    await expect(
      deleteNotebookForContext(testContext(fixture.owner), notebookId, false, fixture.service),
    ).rejects.toMatchObject({ status: 422 })
    await expect(
      getNotebookForContext(testContext(fixture.owner), notebookId, fixture.service),
    ).resolves.toBeDefined()
  })

  it("rejects blank and overlong names", async () => {
    await expect(
      createNotebookForContext(testContext(fixture.owner), "   ", fixture.service),
    ).rejects.toMatchObject({ status: 422 })
    await expect(
      renameNotebookForContext(
        testContext(fixture.owner),
        matrixNotebookId,
        "x".repeat(201),
        fixture.service,
      ),
    ).rejects.toMatchObject({ status: 422 })
  })

  it("blocks deletion while an assistant response is streaming", async () => {
    const question = await fixture.service
      .from("messages")
      .insert({
        content: "Question",
        notebook_id: matrixNotebookId,
        role: "user",
        selected_sources_snapshot: [],
        status: "complete",
        user_id: fixture.owner.id,
      })
      .select("id")
      .single()
    if (question.error) throw question.error

    const answer = await fixture.service.from("messages").insert({
      attempt_no: 1,
      content: "",
      notebook_id: matrixNotebookId,
      question_message_id: question.data.id,
      role: "assistant",
      status: "streaming",
      user_id: fixture.owner.id,
    })
    if (answer.error) throw answer.error

    await expect(
      deleteNotebookForContext(testContext(fixture.owner), matrixNotebookId, true, fixture.service),
    ).rejects.toMatchObject({ status: 409 })
  })
})
