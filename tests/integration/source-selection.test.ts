import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { MAX_SELECTED_SOURCES } from "@/lib/limits"
import { createNotebookForContext, setSourceSelectedForContext } from "@/lib/notebooks/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

async function addReadySource(
  fixture: IntegrationFixture,
  notebookId: string,
  selected: boolean,
): Promise<string> {
  const sourceId = crypto.randomUUID()
  const { error } = await fixture.service.from("sources").insert({
    byte_size: 1,
    content_hash: crypto.randomUUID().replaceAll("-", "").padEnd(64, "0"),
    file_name: `${sourceId}.pdf`,
    id: sourceId,
    is_selected: selected,
    notebook_id: notebookId,
    status: "ready",
    storage_path: `${fixture.owner.id}/${notebookId}/${sourceId}.pdf`,
    user_id: fixture.owner.id,
  })
  if (error) throw error
  return sourceId
}

describe("source selection", () => {
  let fixture: IntegrationFixture

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
  })

  afterAll(async () => fixture.cleanup())

  it("persists an owner's selection change", async () => {
    const notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Selection",
      fixture.service,
    )
    const sourceId = await addReadySource(fixture, notebookId, true)

    await setSourceSelectedForContext(testContext(fixture.owner), sourceId, false, fixture.service)

    const { data, error } = await fixture.service
      .from("sources")
      .select("is_selected")
      .eq("id", sourceId)
      .single()
    if (error) throw error
    expect(data.is_selected).toBe(false)
  })

  it("rejects a foreign source without disclosing it", async () => {
    const notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Private selection",
      fixture.service,
    )
    const sourceId = await addReadySource(fixture, notebookId, false)

    await expect(
      setSourceSelectedForContext(testContext(fixture.stranger), sourceId, true, fixture.service),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 })
  })

  it("enforces the ten-source selection limit", async () => {
    const notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Selection limit",
      fixture.service,
    )
    for (let index = 0; index < MAX_SELECTED_SOURCES; index += 1) {
      await addReadySource(fixture, notebookId, true)
    }
    const extraSourceId = await addReadySource(fixture, notebookId, false)

    await expect(
      setSourceSelectedForContext(testContext(fixture.owner), extraSourceId, true, fixture.service),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", status: 422 })
  })
})
