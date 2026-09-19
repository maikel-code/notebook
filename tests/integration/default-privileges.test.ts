import { execFile as execFileCallback } from "node:child_process"
import { promisify } from "node:util"

import { describe, expect, it } from "vitest"

const execFile = promisify(execFileCallback)

describe("Public schema default privileges", () => {
  it("keeps future postgres tables and functions unavailable to browser roles", async () => {
    const { stdout } = await execFile("docker", [
      "exec",
      "supabase_db_notebook-source-qa",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atc",
      "select defaclobjtype::text || '|' || coalesce(array_to_string(defaclacl, ','), '') from pg_default_acl where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype in ('r', 'f') order by defaclobjtype",
    ])

    const aclByObjectType = new Map<string, string>()
    for (const line of stdout.trim().split("\n").filter(Boolean)) {
      const [objectType, acl] = line.split("|", 2)
      if (objectType && acl !== undefined) aclByObjectType.set(objectType, acl)
    }

    for (const objectType of ["r", "f"]) {
      const acl = aclByObjectType.get(objectType)
      expect(acl, `missing default ACL for ${objectType}`).toBeDefined()
      expect(acl).not.toContain("anon=")
      expect(acl).not.toContain("authenticated=")
    }
  })
})
