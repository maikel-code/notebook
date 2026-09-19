import { execFile as execFileCallback } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"

import { describe, expect, it } from "vitest"

const execFile = promisify(execFileCallback)

async function databaseContainerId(): Promise<string> {
  const config = await readFile("supabase/config.toml", "utf8")
  const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(config)?.[1]
  if (!projectId) throw new Error("supabase/config.toml must define project_id")

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

describe("Public schema default privileges", () => {
  it("keeps future postgres tables, sequences, and functions unavailable to browser roles", async () => {
    const { stdout } = await execFile("docker", [
      "exec",
      await databaseContainerId(),
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atc",
      "select defaclobjtype::text || '|' || coalesce(array_to_string(defaclacl, ','), '') from pg_default_acl where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype in ('r', 'S', 'f') order by defaclobjtype",
    ])

    const aclByObjectType = new Map<string, string>()
    for (const line of stdout.trim().split("\n").filter(Boolean)) {
      const [objectType, acl] = line.split("|", 2)
      if (objectType && acl !== undefined) aclByObjectType.set(objectType, acl)
    }

    for (const objectType of ["r", "S", "f"]) {
      const acl = aclByObjectType.get(objectType)
      expect(acl, `missing default ACL for ${objectType}`).toBeDefined()
      expect(acl).not.toContain("anon=")
      expect(acl).not.toContain("authenticated=")
    }
  })

  it("does not expose the citation consistency trigger function", async () => {
    const { stdout } = await execFile("docker", [
      "exec",
      await databaseContainerId(),
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atc",
      "select coalesce(string_agg(coalesce(acl.grantee::regrole::text, 'public') || ':' || acl.privilege_type, ',' order by coalesce(acl.grantee::regrole::text, 'public')), '') from pg_proc procedure cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) acl where procedure.oid = 'public.enforce_citation_reference_consistency()'::regprocedure",
    ])

    const grants = stdout.trim().split(",").filter(Boolean)
    expect(grants).not.toContain("public:EXECUTE")
    expect(grants).not.toContain("anon:EXECUTE")
    expect(grants).not.toContain("authenticated:EXECUTE")
  })
})
