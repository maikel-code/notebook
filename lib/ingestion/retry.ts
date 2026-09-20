import { MAX_JOB_ATTEMPTS } from "@/lib/limits"

export function nextRetryState(attempt: number): { attempt: number; status: "failed" | "queued" } {
  const nextAttempt = attempt + 1
  return { attempt: nextAttempt, status: nextAttempt >= MAX_JOB_ATTEMPTS ? "failed" : "queued" }
}
