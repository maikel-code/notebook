const E2E_FAILURE_MARKER = "NOTEBOOK_E2E_FAIL_ONCE"
const failedFixtures = new Set<string>()

export class LocalE2EIngestionFailure extends Error {
  constructor() {
    super("Local E2E ingestion fixture failed")
    this.name = "LocalE2EIngestionFailure"
  }
}

function localE2EModeEnabled(): boolean {
  if (process.env.NODE_ENV === "production" || process.env.NOTEBOOK_E2E_INGESTION_MODE !== "1") {
    return false
  }

  try {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname
    return host === "127.0.0.1" || host === "localhost"
  } catch {
    return false
  }
}

export function localE2EPages(bytes: Uint8Array): Array<{ page: number; text: string }> | null {
  if (!localE2EModeEnabled()) return null

  const text = new TextDecoder().decode(bytes)
  const pdfText = /\(([^()]*)\) Tj/.exec(text)?.[1]
  return pdfText ? [{ page: 1, text: pdfText }] : null
}

export async function localE2EEmbeddings(values: string[]): Promise<number[][] | null> {
  if (!localE2EModeEnabled()) return null

  await new Promise((resolve) => setTimeout(resolve, 1_000))
  const failureFixture = values.find((value) => value.includes(E2E_FAILURE_MARKER))
  if (failureFixture && !failedFixtures.has(failureFixture)) {
    failedFixtures.add(failureFixture)
    throw new LocalE2EIngestionFailure()
  }

  return values.map(() => Array.from({ length: 1536 }, () => 0))
}
