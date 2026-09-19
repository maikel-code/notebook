import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getNotebookForContext, listNotebooksForContext } from "@/lib/notebooks/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("Notebook pages access matrix", () => {
  let fixture: IntegrationFixture
  let ownerNotebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    const { data, error } = await fixture.service
      .from("notebooks")
      .insert([
        { name: "Owner notebook", user_id: fixture.owner.id },
        { name: "Stranger notebook", user_id: fixture.stranger.id },
      ])
      .select("id, user_id")

    if (error || !data) throw error
    ownerNotebookId = data.find((notebook) => notebook.user_id === fixture.owner.id)?.id ?? ""
  })

  afterAll(async () => fixture.cleanup())

  it("lists only notebooks owned by the signed-in user", async () => {
    const notebooks = await listNotebooksForContext(testContext(fixture.owner), fixture.service)
    expect(notebooks).toEqual([
      expect.objectContaining({ id: ownerNotebookId, name: "Owner notebook" }),
    ])
  })

  it("loads an owned notebook", async () => {
    await expect(
      getNotebookForContext(testContext(fixture.owner), ownerNotebookId, fixture.service),
    ).resolves.toEqual(expect.objectContaining({ id: ownerNotebookId }))
  })

  it.each([
    ["foreign", () => testContext(fixture.stranger), () => ownerNotebookId, 404],
    ["missing", () => testContext(fixture.owner), () => randomUUID(), 404],
    ["anonymous", () => null, () => ownerNotebookId, 401],
  ])("rejects %s notebook access", async (_label, context, notebookId, status) => {
    await expect(
      getNotebookForContext(context(), notebookId(), fixture.service),
    ).rejects.toMatchObject({ status })
  })
})
