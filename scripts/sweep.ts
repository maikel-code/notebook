import { setTimeout } from "node:timers/promises"

const intervalMilliseconds = 30_000
const endpoint = new URL("/api/jobs/sweep", process.env.APP_URL ?? "http://127.0.0.1:3000")
function jobSecret(): string {
  const secret = process.env.JOB_TRIGGER_SECRET
  if (!secret) throw new Error("JOB_TRIGGER_SECRET is required for the local worker.")
  return secret
}

async function sweep(): Promise<void> {
  const response = await fetch(endpoint, {
    headers: { "x-job-trigger-secret": jobSecret() },
    method: "POST",
  })
  if (!response.ok) throw new Error(`Sweep failed with HTTP ${response.status}`)
}

async function runWorker(): Promise<never> {
  await sweep()
  await setTimeout(intervalMilliseconds)
  return runWorker()
}

await runWorker()
