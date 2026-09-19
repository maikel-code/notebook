import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

export interface ExtractedPage {
  page: number
  text: string
}

export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const document = await getDocument({ data: bytes }).promise
  try {
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
    return pages
  } finally {
    document.cleanup()
  }
}
