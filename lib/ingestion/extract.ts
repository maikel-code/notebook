import { localE2EPages } from "@/lib/ingestion/local-e2e"
import { parsePdf } from "@/lib/ingestion/pdf-runtime"

export interface ExtractedPage {
  page: number
  text: string
}

export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const fixturePages = localE2EPages(bytes)
  if (fixturePages) return fixturePages
  return (await parsePdf(bytes)).pages
}
