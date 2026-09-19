import { execFile as execFileCallback } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

import { config as loadEnvironment } from "dotenv"

const execFile = promisify(execFileCallback)
const lockWaitMilliseconds = 100
const lockWaitTimeoutMilliseconds = 180_000
const incompleteLockThresholdMilliseconds = 15_000

interface LocalSupabaseConfig {
  apiPort: number
  dbPort: number
  projectId: string
}

interface ResetLock {
  directory: string
  ownerFile: string
  owner: string
}

function sectionPort(config: string, section: "api" | "db"): number {
  const port = new RegExp(`^\\[${section}\\][\\s\\S]*?^port\\s*=\\s*(\\d+)`, "m").exec(config)?.[1]
  if (!port) throw new Error(`supabase/config.toml must define [${section}].port`)
  return Number(port)
}

async function readLocalSupabaseConfig(): Promise<LocalSupabaseConfig> {
  const config = await readFile("supabase/config.toml", "utf8")
  const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(config)?.[1]
  if (!projectId) throw new Error("supabase/config.toml must define project_id")

  return {
    apiPort: sectionPort(config, "api"),
    dbPort: sectionPort(config, "db"),
    projectId,
  }
}

function resetLock(config: LocalSupabaseConfig): ResetLock {
  const directory = join(tmpdir(), `notebook-${config.projectId}-integration-reset.lock`)
  return { directory, ownerFile: join(directory, "owner"), owner: `${process.pid}:${randomUUID()}` }
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function isStaleLock(lock: ResetLock): Promise<boolean> {
  try {
    const ownerValue = (await readFile(lock.ownerFile, "utf8")).split(":", 1)[0]
    if (!ownerValue) return false
    const owner = Number.parseInt(ownerValue, 10)
    if (!Number.isInteger(owner)) return false
    process.kill(owner, 0)
    return false
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ESRCH") return true
    if (code !== "ENOENT") return false

    try {
      const metadata = await stat(lock.directory)
      return Date.now() - metadata.mtimeMs >= incompleteLockThresholdMilliseconds
    } catch (statError) {
      if ((statError as NodeJS.ErrnoException).code === "ENOENT") return true
      throw statError
    }
  }
}

async function claimStaleLock(lock: ResetLock): Promise<boolean> {
  const recoveredDirectory = `${lock.directory}.recovered-${process.pid}-${Date.now()}`

  try {
    await rename(lock.directory, recoveredDirectory)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENOENT" || code === "EEXIST") return false
    throw error
  }

  await rm(recoveredDirectory, { force: true, recursive: true })
  return true
}

async function acquireResetLock(config: LocalSupabaseConfig): Promise<ResetLock> {
  const lock = resetLock(config)
  const deadline = Date.now() + lockWaitTimeoutMilliseconds

  while (Date.now() < deadline) {
    try {
      await mkdir(lock.directory)
      await writeFile(lock.ownerFile, lock.owner)
      return lock
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      if ((await isStaleLock(lock)) && (await claimStaleLock(lock))) continue
      await sleep(lockWaitMilliseconds)
    }
  }

  throw new Error("Timed out waiting for the local integration database reset lock")
}

async function releaseResetLock(lock: ResetLock): Promise<void> {
  try {
    if ((await readFile(lock.ownerFile, "utf8")) !== lock.owner) return
    const releasedDirectory = `${lock.directory}.released-${randomUUID()}`
    await rename(lock.directory, releasedDirectory)
    await rm(releasedDirectory, { force: true, recursive: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
}

function sameLocalSupabaseConfig(left: LocalSupabaseConfig, right: LocalSupabaseConfig): boolean {
  return (
    left.projectId === right.projectId &&
    left.apiPort === right.apiPort &&
    left.dbPort === right.dbPort
  )
}

async function localDatabaseContainerId(projectId: string): Promise<string> {
  const { stdout } = await execFile("docker", [
    "ps",
    "--filter",
    `label=com.supabase.cli.project=${projectId}`,
    "--format",
    "{{.ID}}|{{.Names}}",
  ])
  const database = stdout
    .trim()
    .split("\n")
    .map((line) => line.split("|", 2))
    .find(([, name]) => name === `supabase_db_${projectId}`)

  if (!database?.[0]) {
    throw new Error(`Local Supabase database container for ${projectId} is not running`)
  }
  return database[0]
}

async function validateLocalTargets(config: LocalSupabaseConfig): Promise<void> {
  const integrationUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  if (
    !["127.0.0.1", "localhost"].includes(integrationUrl.hostname) ||
    integrationUrl.port !== String(config.apiPort)
  ) {
    throw new Error(
      `Integration URL must target local Supabase API port ${config.apiPort}, received ${integrationUrl.origin}`,
    )
  }

  const containerId = await localDatabaseContainerId(config.projectId)
  const { stdout } = await execFile("docker", [
    "inspect",
    "--format",
    '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
    containerId,
  ])
  if (stdout.trim() !== String(config.dbPort)) {
    throw new Error(
      `Local Supabase database for ${config.projectId} must expose port ${config.dbPort}, received ${stdout.trim()}`,
    )
  }
}

export default async function globalSetup() {
  loadEnvironment({ path: ".env.local", quiet: true })
  const config = await readLocalSupabaseConfig()
  const lock = await acquireResetLock(config)

  try {
    if (!sameLocalSupabaseConfig(config, await readLocalSupabaseConfig())) {
      throw new Error("supabase/config.toml changed while waiting for the integration reset lock")
    }
    await validateLocalTargets(config)
    await execFile("supabase", ["db", "reset", "--local"], {
      cwd: process.cwd(),
      env: { ...process.env, SUPABASE_TELEMETRY_ENABLED: "false" },
    })
    if (!sameLocalSupabaseConfig(config, await readLocalSupabaseConfig())) {
      throw new Error("supabase/config.toml changed during the integration database reset")
    }
    await validateLocalTargets(config)
  } catch (error) {
    await releaseResetLock(lock)
    throw error
  }

  return async () => {
    await releaseResetLock(lock)
  }
}
