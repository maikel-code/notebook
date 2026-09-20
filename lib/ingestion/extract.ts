import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

import { localE2EPages } from "@/lib/ingestion/local-e2e"

export interface ExtractedPage {
  page: number
  text: string
}

export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const fixturePages = localE2EPages(bytes)
  if (fixturePages) return fixturePages
  const loadingTask = getDocument({ data: bytes })
  try {
    const document = await loadingTask.promise
    const pages: ExtractedPage[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replaceAll(/\s+/g, " ")
        .trim()
      pages.push({ page: pageNumber, text })
    }
    document.cleanup()
    return pages
  } finally {
    await loadingTask.destroy()
  }
}
