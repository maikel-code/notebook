import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { sourceStoragePath } from "@/lib/ingestion/storage"
import { MAX_FILE_BYTES } from "@/lib/limits"
import { createIntegrationFixture, type IntegrationFixture } from "@/tests/integration/setup"

describe("storage access boundary", () => {
  let fixture: IntegrationFixture
  let path: string

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    path = sourceStoragePath(fixture.owner.id, crypto.randomUUID(), crypto.randomUUID())
    const { error } = await fixture.owner.client.storage
      .from("sources")
      .upload(path, new Blob(["%PDF-1.4"], { type: "application/pdf" }), {
        contentType: "application/pdf",
      })
    if (error) throw error
  })

  afterAll(async () => fixture.cleanup())

  it("uses an owner-scoped, fixed PDF path", () => {
    expect(sourceStoragePath("user", "notebook", "source")).toBe("user/notebook/source.pdf")
  })

  it("allows only the owner to read and forbids browser updates and deletes", async () => {
    await expect(
      fixture.owner.client.storage.from("sources").download(path),
    ).resolves.toMatchObject({
      error: null,
    })
    await expect(
      fixture.stranger.client.storage.from("sources").download(path),
    ).resolves.toMatchObject({
      data: null,
    })
    await expect(fixture.anonymous.storage.from("sources").download(path)).resolves.toMatchObject({
      data: null,
    })
    await expect(
      fixture.owner.client.storage.from("sources").update(path, new Blob(["changed"])),
    ).resolves.toMatchObject({ data: null })
    await expect(
      fixture.owner.client.storage.from("sources").remove([path]),
    ).resolves.toMatchObject({
      data: [],
    })
    await expect(
      fixture.owner.client.storage.from("sources").download(path),
    ).resolves.toMatchObject({
      error: null,
    })
  })

  it("enforces size, MIME, owner path and missing-object boundaries", async () => {
    const exactPath = sourceStoragePath(fixture.owner.id, crypto.randomUUID(), crypto.randomUUID())
    await expect(
      fixture.owner.client.storage
        .from("sources")
        .upload(
          exactPath,
          new Blob([new Uint8Array(MAX_FILE_BYTES)], { type: "application/pdf" }),
          {
            contentType: "application/pdf",
          },
        ),
    ).resolves.toMatchObject({ error: null })
    const blockedPath = sourceStoragePath(
      fixture.owner.id,
      crypto.randomUUID(),
      crypto.randomUUID(),
    )
    const validPdf = new Blob(["%PDF-1.4"], { type: "application/pdf" })
    await expect(
      fixture.stranger.client.storage.from("sources").upload(blockedPath, validPdf, {
        contentType: "application/pdf",
      }),
    ).resolves.toMatchObject({ data: null, error: expect.anything() })
    await expect(
      fixture.anonymous.storage.from("sources").upload(blockedPath, validPdf, {
        contentType: "application/pdf",
      }),
    ).resolves.toMatchObject({ data: null, error: expect.anything() })
    await expect(
      fixture.owner.client.storage.from("sources").download("missing/path.pdf"),
    ).resolves.toMatchObject({ data: null })
    await expect(
      fixture.owner.client.storage
        .from("sources")
        .upload(
          sourceStoragePath(fixture.owner.id, crypto.randomUUID(), crypto.randomUUID()),
          new Blob([new Uint8Array(MAX_FILE_BYTES + 1)], { type: "application/pdf" }),
          { contentType: "application/pdf" },
        ),
    ).resolves.toMatchObject({ data: null })
    await expect(
      fixture.owner.client.storage
        .from("sources")
        .upload(
          sourceStoragePath(fixture.owner.id, crypto.randomUUID(), crypto.randomUUID()),
          new Blob(["image"], { type: "image/png" }),
          { contentType: "image/png" },
        ),
    ).resolves.toMatchObject({ data: null })
  })
})
