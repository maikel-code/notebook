import { describe, expect, it } from "vitest"

import { POST as run } from "@/app/api/jobs/run/route"
import { hasValidJobSecret } from "@/lib/ingestion/job-secret"

describe("internal job access", () => {
  it("accepts only the configured secret", () => {
    expect(hasValidJobSecret(undefined, "a".repeat(32))).toBe(false)
    expect(hasValidJobSecret("wrong", "a".repeat(32))).toBe(false)
    expect(hasValidJobSecret("a".repeat(32), "a".repeat(32))).toBe(true)
  })

  it("rejects missing and invalid callers before work, and accepts the internal trigger", async () => {
    await expect(
      run(new Request("http://localhost/api/jobs/run", { method: "POST" })),
    ).resolves.toMatchObject({
      status: 401,
    })
    await expect(
      run(
        new Request("http://localhost/api/jobs/run", {
          headers: { "x-job-trigger-secret": "invalid" },
          method: "POST",
        }),
      ),
    ).resolves.toMatchObject({ status: 401 })
    await expect(
      run(
        new Request("http://localhost/api/jobs/run", {
          headers: { "x-job-trigger-secret": process.env.JOB_TRIGGER_SECRET ?? "" },
          method: "POST",
        }),
      ),
    ).resolves.toMatchObject({ status: 200 })
  })
})
