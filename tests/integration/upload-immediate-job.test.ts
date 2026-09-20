import { describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ service: {} }))
const runJob = vi.hoisted(() => vi.fn(async () => true))

vi.mock("@/lib/auth/authorize", () => ({ requireUser: async () => ({ userId: "owner" }) }))
vi.mock("@/lib/ingestion/run-job", () => ({ runNextIngestionJob: runJob }))
vi.mock("@/lib/ingestion/upload", () => ({ confirmUploadForContext: vi.fn(async () => undefined) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: () => state.service }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { confirmUpload } from "@/app/notebooks/actions"

describe("confirmUpload immediate processing", () => {
  it("starts the server-side job after an accepted upload without a browser secret", async () => {
    await confirmUpload("source-id")
    expect(runJob).toHaveBeenCalledWith(state.service, "source-id")
  })
})
