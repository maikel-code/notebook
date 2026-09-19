import { describe, expect, it } from "vitest"

import { nextRetryState } from "@/lib/ingestion/retry"

describe("ingestion retries", () => {
  it("stops automatic retries after three attempts", () => {
    expect(nextRetryState(2)).toEqual({ attempt: 3, status: "failed" })
    expect(nextRetryState(1)).toEqual({ attempt: 2, status: "queued" })
  })
})
