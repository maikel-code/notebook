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

test("a complete answer can be saved and opened as a studio note", async ({ page }) => {
  const email = `studio-${randomUUID()}@example.test`
  await page.goto("/sign-up")
  await page.getByLabel("E-Mail-Adresse").fill(email)
  await page.getByLabel("Passwort").fill("Local-test-password-42!")
  await page.getByRole("button", { name: "Registrieren" }).click()
  await page.getByLabel("Notebook-Name").fill("Studio notes")
  await page.getByRole("button", { name: "Notebook anlegen" }).click()
  await page.getByRole("link", { name: "Studio notes" }).click()

  await page.getByLabel("PDF hinzufügen").setInputFiles({
    buffer: textPdf("Die Mitgliedschaft kostet jährlich 180 Euro."),
    mimeType: "application/pdf",
    name: "mitgliedschaft.pdf",
  })
  await expect(page.getByRole("list", { name: "Quellen" })).toContainText("bereit")
  const question = "Welche zentrale Regel nennt diese Quelle?"
  await page.getByRole("button", { name: question }).click()
  await expect(page.getByRole("button", { name: "In Notiz speichern" })).toBeVisible()
  await page.getByRole("button", { name: "In Notiz speichern" }).click()
  await expect(page.getByLabel("Studio-Notizen")).toContainText(question)
  await expect(page.getByRole("button", { name: "In Notiz speichern" })).toHaveCount(0)
  await page.reload()
  await expect(page.getByLabel("Studio-Notizen")).toContainText(question)
  const noteButton = page.getByRole("button", { name: question })
  await noteButton.click()
  await expect(noteButton).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByLabel("Studio-Notiz")).toContainText(question)
  await noteButton.click()
  await expect(noteButton).toHaveAttribute("aria-pressed", "false")
  await expect(page.getByLabel("Studio-Notiz")).toHaveCount(0)
})
