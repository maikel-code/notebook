import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { importWebSourcesForContext } from "@/lib/ingestion/web-import"
import { createNotebookForContext } from "@/lib/notebooks/service"
import { searchWebSourcesForContext } from "@/lib/web/search"
import { PRIVATE_WEB_URL, PUBLIC_WEB_RESULT } from "@/tests/fixtures/workspace-sources"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("web source services", () => {
  let fixture: IntegrationFixture
  let notebookId: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    notebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Web sources",
      fixture.service,
    )
  })

  afterAll(async () => fixture.cleanup())

  it("limits owner-scoped searches and does not persist their results", async () => {
    const adapter = vi.fn().mockResolvedValue(Array.from({ length: 12 }, () => PUBLIC_WEB_RESULT))
    await expect(
      searchWebSourcesForContext(
        testContext(fixture.owner),
        { notebookId, query: "Mitgliedschaft" },
        fixture.service,
        adapter,
      ),
    ).resolves.toEqual([PUBLIC_WEB_RESULT])
    expect(adapter).toHaveBeenCalledWith("Mitgliedschaft")
    const { count, error } = await fixture.service
      .from("sources")
      .select("id", { count: "exact", head: true })
      .eq("notebook_id", notebookId)
    expect(error).toBeNull()
    expect(count).toBe(0)

    for (const context of [testContext(fixture.stranger), null]) {
      await expect(
        searchWebSourcesForContext(
          context,
          { notebookId, query: "Mitgliedschaft" },
          fixture.service,
          adapter,
        ),
      ).rejects.toMatchObject({ status: context ? 404 : 401 })
    }
  })

  it("imports only confirmed public URLs, returns duplicate and rejected outcomes per item", async () => {
    const result = await importWebSourcesForContext(
      testContext(fixture.owner),
      { notebookId, urls: [PUBLIC_WEB_RESULT.url, PUBLIC_WEB_RESULT.url, PRIVATE_WEB_URL] },
      fixture.service,
    )
    expect(result.outcomes).toEqual([
      expect.objectContaining({ status: "started", url: PUBLIC_WEB_RESULT.url }),
      expect.objectContaining({ status: "already_present", url: PUBLIC_WEB_RESULT.url }),
      expect.objectContaining({ status: "rejected", url: PRIVATE_WEB_URL }),
    ])

    const { data, error } = await fixture.service
      .from("sources")
      .select("source_kind, status, origin_url, canonical_url")
      .eq("notebook_id", notebookId)
    expect(error).toBeNull()
    expect(data).toEqual([
      expect.objectContaining({
        canonical_url: PUBLIC_WEB_RESULT.url,
        origin_url: PUBLIC_WEB_RESULT.url,
        source_kind: "web",
        status: "processing",
      }),
    ])
  })
})
