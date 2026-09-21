import { HttpError, validationError } from "@/lib/http/errors"
import { localE2EPages } from "@/lib/ingestion/local-e2e"
import { parsePdf } from "@/lib/ingestion/pdf-runtime"
import { MAX_FILE_BYTES, MAX_PAGES } from "@/lib/limits"

export interface ValidatedPdf {
  pageCount: number
}

function rejected(message: string): never {
  throw validationError(message)
}

function parserErrorName(error: unknown): string {
  if (!(error instanceof Error)) return "UnknownPdfError"
  return /^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(error.name) ? error.name : "UnknownPdfError"
}

export async function validatePdf(bytes: Uint8Array, _fileName: string): Promise<ValidatedPdf> {
  if (bytes.byteLength === 0) rejected("Die PDF-Datei ist leer.")
  if (bytes.byteLength > MAX_FILE_BYTES) rejected("Die PDF-Datei darf höchstens 10 MB groß sein.")
  if (
    bytes.byteLength < 5 ||
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46 ||
    bytes[4] !== 0x2d
  ) {
    rejected("Die Datei ist keine gültige PDF-Datei.")
  }

  if (localE2EPages(bytes)) return { pageCount: 1 }

  try {
    // PDF.js may transfer the supplied ArrayBuffer to its worker. Validation must
    // leave the original intact for the following extraction job.
    const { pageCount } = await parsePdf(bytes.slice())
    if (pageCount > MAX_PAGES) rejected("Die PDF-Datei darf höchstens 50 Seiten haben.")
    return { pageCount }
  } catch (error) {
    if (error instanceof HttpError) throw error
    const errorName = parserErrorName(error)
    if (errorName === "PasswordException")
      rejected("Passwortgeschützte PDF-Dateien werden nicht unterstützt.")
    rejected("Die PDF-Datei ist beschädigt oder kann nicht gelesen werden.")
  }
}
