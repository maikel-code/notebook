import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getNotebookForContext } from "@/lib/notebooks/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("No existence disclosure", () => {
  let fixture: IntegrationFixture
  let ownerNotebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    const { data, error } = await fixture.service
      .from("notebooks")
      .insert({ name: "Private", user_id: fixture.owner.id })
      .select("id")
      .single()
    if (error) throw error
    ownerNotebookId = data.id
  })

  afterAll(async () => fixture.cleanup())

  it("returns the identical neutral error for foreign and absent IDs", async () => {
    const errors = await Promise.all(
      [ownerNotebookId, randomUUID()].map(async (id) => {
        try {
          await getNotebookForContext(testContext(fixture.stranger), id, fixture.service)
          throw new Error("Expected access to fail")
        } catch (error) {
          return error
        }
      }),
    )

    expect(errors[0]).toMatchObject({ code: "NOT_FOUND", status: 404 })
    expect(errors[1]).toMatchObject({ code: "NOT_FOUND", status: 404 })
    expect((errors[0] as Error).message).toBe((errors[1] as Error).message)
    expect((errors[0] as Error).message).not.toContain(ownerNotebookId)
  })
})
