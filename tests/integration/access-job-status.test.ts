import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { listJobStatusForContext } from "@/lib/ingestion/status"
import { createNotebookForContext } from "@/lib/notebooks/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("job status access matrix", () => {
  let fixture: IntegrationFixture
  let notebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    notebookId = await createNotebookForContext(testContext(fixture.owner), "Jobs", fixture.service)
  })

  afterAll(async () => fixture.cleanup())

  it("requires an owner context", async () => {
    await expect(listJobStatusForContext(null, "missing", {} as never)).rejects.toMatchObject({
      status: 401,
    })
  })

  it("returns only the owner's notebook status and hides foreign or missing notebooks", async () => {
    await expect(
      listJobStatusForContext(testContext(fixture.owner), notebookId, fixture.service),
    ).resolves.toEqual([])
    await expect(
      listJobStatusForContext(testContext(fixture.stranger), notebookId, fixture.service),
    ).rejects.toMatchObject({ status: 404 })
  })
})
