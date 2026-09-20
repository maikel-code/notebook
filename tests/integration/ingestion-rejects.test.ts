import { describe, expect, it } from "vitest"

import { validatePdf } from "@/lib/ingestion/validate-pdf"
import { MAX_FILE_BYTES, MAX_PAGES } from "@/lib/limits"

describe("ingestion rejection", () => {
  it("rejects non-PDF, empty, oversized and malformed data without exposing content", async () => {
    await expect(validatePdf(new Uint8Array(), "empty.pdf")).rejects.toMatchObject({ status: 422 })
    await expect(
      validatePdf(new TextEncoder().encode("not a pdf"), "image.png"),
    ).rejects.toMatchObject({
      status: 422,
    })
    await expect(
      validatePdf(new Uint8Array(MAX_FILE_BYTES + 1), "large.pdf"),
    ).rejects.toMatchObject({
      status: 422,
    })
  })

  it("rejects password-protected and overlong PDFs", async () => {
    const encrypted = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1 1] >>
endobj
4 0 obj
<< /Filter /Standard /V 1 /R 2 /Length 40 /O <0000000000000000000000000000000000000000000000000000000000000000> /U <0000000000000000000000000000000000000000000000000000000000000000> /P -4 >>
endobj
trailer
<< /Root 1 0 R /Encrypt 4 0 R >>
%%EOF`
    await expect(
      validatePdf(new TextEncoder().encode(encrypted), "locked.pdf"),
    ).rejects.toMatchObject({ status: 422 })
    const pages = Array.from({ length: MAX_PAGES + 1 }, (_, index) => `${index + 3} 0 R`).join(" ")
    const pageObjects = Array.from(
      { length: MAX_PAGES + 1 },
      (_, index) =>
        `${index + 3} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1 1] >>\nendobj`,
    ).join("\n")
    const overlong = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [${pages}] /Count ${MAX_PAGES + 1} >>\nendobj\n${pageObjects}\ntrailer\n<< /Root 1 0 R >>\n%%EOF`
    await expect(validatePdf(new TextEncoder().encode(overlong), "long.pdf")).rejects.toMatchObject(
      {
        message: "Die PDF-Datei darf höchstens 50 Seiten haben.",
        status: 422,
      },
    )
  })
})
