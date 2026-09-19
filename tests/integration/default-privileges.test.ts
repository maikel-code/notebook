import { execFile as execFileCallback } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"

import { describe, expect, it } from "vitest"

const execFile = promisify(execFileCallback)

interface FunctionPrivileges {
  anon: boolean
  authenticated: boolean
  public: boolean
}

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

async function databaseQuery(query: string): Promise<string> {
  const { stdout } = await execFile("docker", [
    "exec",
    await databaseContainerId(),
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-q",
    "-Atc",
    query,
  ])
  return stdout.trim()
}

function browserDefaultGrants(acl: string): string[] {
  return acl
    .split(",")
    .filter(Boolean)
    .filter(
      (grant) =>
        grant.startsWith("=") || grant.startsWith("anon=") || grant.startsWith("authenticated="),
    )
}

async function citationFunctionPrivileges(prefix = ""): Promise<FunctionPrivileges> {
  const [publicRole, anon, authenticated] = (
    await databaseQuery(
      `${prefix}select has_function_privilege('public', 'public.enforce_citation_reference_consistency()', 'execute')::text || '|' || has_function_privilege('anon', 'public.enforce_citation_reference_consistency()', 'execute')::text || '|' || has_function_privilege('authenticated', 'public.enforce_citation_reference_consistency()', 'execute')::text;${prefix ? " rollback" : ""}`,
    )
  ).split("|")

  return {
    anon: anon === "true",
    authenticated: authenticated === "true",
    public: publicRole === "true",
  }
}

describe("Public schema default privileges", () => {
  it("keeps future postgres tables, sequences, and functions unavailable to browser roles", async () => {
    const stdout = await databaseQuery(
      "select defaclobjtype::text || '|' || coalesce(array_to_string(defaclacl, ','), '') from pg_default_acl where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype in ('r', 'S', 'f') order by defaclobjtype",
    )

    const aclByObjectType = new Map<string, string>()
    for (const line of stdout.trim().split("\n").filter(Boolean)) {
      const [objectType, acl] = line.split("|", 2)
      if (objectType && acl !== undefined) aclByObjectType.set(objectType, acl)
    }

    for (const objectType of ["r", "S", "f"]) {
      const acl = aclByObjectType.get(objectType)
      expect(acl, `missing default ACL for ${objectType}`).toBeDefined()
      expect(browserDefaultGrants(acl ?? ""), `browser grant on ${objectType}`).toEqual([])
    }
  })

  it("does not expose the citation consistency trigger function", async () => {
    await expect(citationFunctionPrivileges()).resolves.toEqual({
      anon: false,
      authenticated: false,
      public: false,
    })
  })

  it("detects a simulated PUBLIC default function grant", async () => {
    const stdout = await databaseQuery(
      "begin; alter default privileges for role postgres in schema public grant execute on functions to public; select coalesce(array_to_string(defaclacl, ','), '') from pg_default_acl where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype = 'f'; rollback",
    )

    expect(browserDefaultGrants(stdout)).toContain("=X/postgres")
  })

  it("detects a simulated PUBLIC trigger-function grant", async () => {
    await expect(
      citationFunctionPrivileges(
        "begin; grant execute on function public.enforce_citation_reference_consistency() to public; ",
      ),
    ).resolves.toEqual({
      anon: true,
      authenticated: true,
      public: true,
    })
  })
})
