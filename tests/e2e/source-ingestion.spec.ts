import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

function textPdf(text: string): Buffer {
  const stream = `BT\n/F1 18 Tf\n72 720 Td\n(${text}) Tj\nET`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += `${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}

test("source upload changes status without reload and offers a working retry with a clear cause", async ({
  page,
}) => {
  const email = `ingestion-${randomUUID()}@example.test`
  await page.goto("/sign-up")
  await page.getByLabel("E-Mail-Adresse").fill(email)
  await page.getByLabel("Passwort").fill("Local-test-password-42!")
  await page.getByRole("button", { name: "Registrieren" }).click()
  await page.getByLabel("Notebook-Name").fill("PDF source")
  await page.getByRole("button", { name: "Notebook anlegen" }).click()
  await page.getByRole("link", { name: "PDF source" }).click()

  const sourceInput = page.getByLabel("PDF-Quelle hinzufügen")
  await expect(sourceInput).toBeVisible()

  await sourceInput.setInputFiles({
    buffer: textPdf("Deterministic local E2E source"),
    mimeType: "application/pdf",
    name: "ready.pdf",
  })
  const sources = page.getByRole("list", { name: "Quellen" })
  await expect(page.getByRole("status")).toContainText("Quelle wird verarbeitet")
  await expect(page.getByRole("button", { name: "Upload abbrechen" })).toHaveCount(0)
  await expect(sources).toContainText("ready.pdf")
  await expect(sources).toContainText("bereit")
  await expect(page).toHaveURL(/\/notebooks\/[0-9a-f-]+$/i)

  await sourceInput.setInputFiles({
    buffer: textPdf("Deterministic local E2E source"),
    mimeType: "application/pdf",
    name: "ready.pdf",
  })
  const duplicateDialog = page.getByRole("dialog")
  await expect(duplicateDialog).toContainText("Datei bereits vorhanden")
  await duplicateDialog.getByRole("button", { name: "Abbrechen" }).click()
  await expect(duplicateDialog).toHaveCount(0)

  await sourceInput.setInputFiles({
    buffer: textPdf("NOTEBOOK_E2E_FAIL_ONCE"),
    mimeType: "application/pdf",
    name: "retry.pdf",
  })
  await expect(sources).toContainText("retry.pdf")
  await expect(sources).toContainText("fehlgeschlagen")
  await expect(sources).toContainText(
    "Die Einbettungen für die PDF-Datei konnten nicht erstellt werden.",
  )

  await page.getByRole("button", { name: "Erneut versuchen" }).click()
  await expect(sources).toContainText("bereit")
})
