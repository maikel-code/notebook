import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { POST as run } from "@/app/api/jobs/run/route"
import { POST as sweep } from "@/app/api/jobs/sweep/route"
import { hasValidJobSecret } from "@/lib/ingestion/job-secret"
import { loadOwnedJobSource, runNextIngestionJob } from "@/lib/ingestion/run-job"
import { sourceStoragePath } from "@/lib/ingestion/storage"
import { createNotebookForContext } from "@/lib/notebooks/service"
import {
  createIntegrationFixture,
  type IntegrationFixture,
  testContext,
} from "@/tests/integration/setup"

describe("internal job access", () => {
  let fixture: IntegrationFixture

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
  })

  afterAll(async () => fixture.cleanup())

  it("accepts only the configured secret", () => {
    expect(hasValidJobSecret(undefined, "a".repeat(32))).toBe(false)
    expect(hasValidJobSecret("wrong", "a".repeat(32))).toBe(false)
    expect(hasValidJobSecret("a".repeat(32), "a".repeat(32))).toBe(true)
  })

  it.each([
    ["run", run, "http://localhost/api/jobs/run"],
    ["sweep", sweep, "http://localhost/api/jobs/sweep"],
  ] as const)("%s accepts only the configured secret", async (_name, handler, url) => {
    await expect(handler(new Request(url, { method: "POST" }))).resolves.toMatchObject({
      status: 401,
    })
    await expect(
      handler(
        new Request(url, {
          headers: { "x-job-trigger-secret": "invalid" },
          method: "POST",
        }),
      ),
    ).resolves.toMatchObject({ status: 401 })
    await expect(
      handler(
        new Request(url, {
          headers: { "x-job-trigger-secret": process.env.JOB_TRIGGER_SECRET ?? "" },
          method: "POST",
        }),
      ),
    ).resolves.toMatchObject({ status: 200 })
  })

  it("keeps a service-role job in the claimed owner's context and never changes another user source", async () => {
    const ownerNotebookId = await createNotebookForContext(
      testContext(fixture.owner),
      "Owner worker",
      fixture.service,
    )
    const strangerNotebookId = await createNotebookForContext(
      testContext(fixture.stranger),
      "Stranger worker",
      fixture.service,
    )
    const ownerSourceId = crypto.randomUUID()
    const strangerSourceId = crypto.randomUUID()
    const { error: sourceError } = await fixture.service.from("sources").insert([
      {
        byte_size: 1,
        content_hash: "a".repeat(64),
        file_name: "owner.pdf",
        id: ownerSourceId,
        notebook_id: ownerNotebookId,
        status: "processing",
        storage_path: sourceStoragePath(fixture.owner.id, ownerNotebookId, ownerSourceId),
        user_id: fixture.owner.id,
      },
      {
        byte_size: 1,
        content_hash: "b".repeat(64),
        file_name: "stranger.pdf",
        id: strangerSourceId,
        notebook_id: strangerNotebookId,
        status: "ready",
        storage_path: sourceStoragePath(fixture.stranger.id, strangerNotebookId, strangerSourceId),
        user_id: fixture.stranger.id,
      },
    ])
    if (sourceError) throw sourceError
    const { error: jobError } = await fixture.service.from("ingestion_jobs").insert({
      source_id: ownerSourceId,
      status: "queued",
      user_id: fixture.owner.id,
    })
    if (jobError) throw jobError

    await expect(runNextIngestionJob(fixture.service, ownerSourceId)).resolves.toBe(true)
    const { data: strangerSource, error: checkError } = await fixture.service
      .from("sources")
      .select("status")
      .eq("id", strangerSourceId)
      .eq("user_id", fixture.stranger.id)
      .single()
    if (checkError) throw checkError
    expect(strangerSource.status).toBe("ready")
  })

  it("requests the claimed source with its owner filter", async () => {
    const filters: Array<[string, string]> = []
    const service = {
      from: () => ({
        select: () => ({
          eq: (column: string, value: string) => {
            filters.push([column, value])
            return {
              eq: (nextColumn: string, nextValue: string) => {
                filters.push([nextColumn, nextValue])
                return { maybeSingle: async () => ({ data: null, error: null }) }
              },
            }
          },
        }),
      }),
    }
    await expect(loadOwnedJobSource(service as never, "source-id", "owner-id")).rejects.toThrow(
      "Auftragsquelle fehlt",
    )
    expect(filters).toEqual([
      ["id", "source-id"],
      ["user_id", "owner-id"],
    ])
  })
})
