import "server-only"

import { CanvasFactory } from "pdf-parse/worker"

export interface ParsedPdf {
  pageCount: number
  pages: Array<{
    page: number
    text: string
  }>
}

export async function parsePdf(bytes: Uint8Array): Promise<ParsedPdf> {
  // The worker initializes CanvasFactory and Node polyfills before PDFParse evaluates PDF.js.
  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: bytes, CanvasFactory })
  try {
    const result = await parser.getText()
    return {
      pageCount: result.total,
      pages: result.pages.map(({ num, text }) => ({ page: num, text })),
    }
  } finally {
    await parser.destroy()
  }
}
