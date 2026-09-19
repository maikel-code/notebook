import { execFile as execFileCallback } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

const execFile = promisify(execFileCallback)
const lockDirectory = join(tmpdir(), "notebook-source-qa-integration-reset.lock")
const lockOwnerFile = join(lockDirectory, "owner")
const lockWaitMilliseconds = 100
const lockTimeoutMilliseconds = 120_000

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function staleLock(): Promise<boolean> {
  try {
    const owner = Number.parseInt(await readFile(lockOwnerFile, "utf8"), 10)
    if (!Number.isInteger(owner)) return true
    process.kill(owner, 0)
    return false
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ESRCH") return true
    if (code !== "ENOENT" || existsSync(lockOwnerFile)) return false

    const metadata = await stat(lockDirectory)
    return Date.now() - metadata.mtimeMs > lockTimeoutMilliseconds
  }
}

async function acquireResetLock(): Promise<void> {
  const deadline = Date.now() + lockTimeoutMilliseconds

  while (Date.now() < deadline) {
    try {
      await mkdir(lockDirectory)
      await writeFile(lockOwnerFile, String(process.pid))
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      if (await staleLock()) {
        await rm(lockDirectory, { force: true, recursive: true })
        continue
      }
      await sleep(lockWaitMilliseconds)
    }
  }

  throw new Error("Timed out waiting for the local integration database reset lock")
}

export default async function globalSetup() {
  await acquireResetLock()

  try {
    await execFile("supabase", ["db", "reset", "--local"], {
      env: { ...process.env, SUPABASE_TELEMETRY_ENABLED: "false" },
    })
  } catch (error) {
    await rm(lockDirectory, { force: true, recursive: true })
    throw error
  }

  return async () => {
    await rm(lockDirectory, { force: true, recursive: true })
  }
}
