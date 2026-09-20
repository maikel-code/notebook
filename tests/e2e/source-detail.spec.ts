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

test("a keyboard user can read a source, see a processing error, and return to the workspace", async ({
  page,
}) => {
  const email = `source-detail-${randomUUID()}@example.test`
  await page.goto("/sign-up")
  await page.getByLabel("E-Mail-Adresse").fill(email)
  await page.getByLabel("Passwort").fill("Local-test-password-42!")
  await page.getByRole("button", { name: "Registrieren" }).click()
  await page.getByLabel("Notebook-Name").fill("Source detail")
  await page.getByRole("button", { name: "Notebook anlegen" }).click()
  await page.getByRole("link", { name: "Source detail" }).click()

  await page.getByLabel("PDF-Quelle hinzufügen").setInputFiles({
    buffer: textPdf("Vollständiger extrahierter Text der Quelle."),
    mimeType: "application/pdf",
    name: "readable.pdf",
  })
  await expect(page.getByRole("list", { name: "Quellen" })).toContainText("bereit")

  const readSource = page.getByRole("button", { name: "Quelle lesen" }).first()
  await readSource.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("heading", { name: "readable.pdf" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Vollständiger Quellentext" })).toContainText(
    "Vollständiger extrahierter Text der Quelle.",
  )
  await page.getByRole("button", { name: "Zurück zum Arbeitsbereich" }).click()
  await expect(page.getByText("Chat", { exact: true })).toBeVisible()

  await page.getByLabel("PDF-Quelle hinzufügen").setInputFiles({
    buffer: textPdf("NOTEBOOK_E2E_FAIL_ONCE"),
    mimeType: "application/pdf",
    name: "failed-detail.pdf",
  })
  await expect(page.getByRole("list", { name: "Quellen" })).toContainText("fehlgeschlagen")
  await page.getByRole("button", { name: "Quelle lesen" }).last().click()
  await expect(page.getByRole("status")).toContainText(
    "Die Einbettungen für die PDF-Datei konnten nicht erstellt werden.",
  )
})
