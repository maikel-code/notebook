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

test("the first ready source creates one cited orientation, while failures and later sources do not", async ({
  page,
}) => {
  const email = `orientation-${randomUUID()}@example.test`
  await page.goto("/sign-up")
  await page.getByLabel("E-Mail-Adresse").fill(email)
  await page.getByLabel("Passwort").fill("Local-test-password-42!")
  await page.getByRole("button", { name: "Registrieren" }).click()
  await page.getByLabel("Notebook-Name").fill("First source orientation")
  await page.getByRole("button", { name: "Notebook anlegen" }).click()
  await page.getByRole("link", { name: "First source orientation" }).click()

  const sourceInput = page.getByLabel("PDF-Quelle hinzufügen")
  await sourceInput.setInputFiles({
    buffer: textPdf("Die Freigabe erfolgt am Montag."),
    mimeType: "application/pdf",
    name: "first.pdf",
  })

  await expect(page.getByRole("list", { name: "Quellen" })).toContainText("first.pdf")
  await expect(page.getByRole("list", { name: "Quellen" })).toContainText("bereit")
  await expect(page.getByText("Erste Orientierung", { exact: true })).toHaveCount(1)
  await expect(page.getByRole("button", { name: /Quelle: first.pdf, Seite 1/ })).toBeVisible()
  const starterQuestion = "Welche zentrale Regel nennt diese Quelle?"
  await expect(page.getByRole("button", { name: starterQuestion })).toBeVisible()

  await page.getByRole("button", { name: starterQuestion }).click()
  await expect(page.getByRole("button", { name: starterQuestion })).toHaveCount(0)
  await expect(page.getByText(starterQuestion, { exact: true })).toBeVisible()

  await sourceInput.setInputFiles({
    buffer: textPdf("Eine weitere bereite Quelle."),
    mimeType: "application/pdf",
    name: "second.pdf",
  })
  await expect(page.getByRole("list", { name: "Quellen" })).toContainText("second.pdf")
  await expect(page.getByRole("list", { name: "Quellen" })).toContainText("bereit")
  await expect(page.getByText("Erste Orientierung", { exact: true })).toHaveCount(1)

  await sourceInput.setInputFiles({
    buffer: textPdf("NOTEBOOK_E2E_FAIL_ONCE"),
    mimeType: "application/pdf",
    name: "failed.pdf",
  })
  await expect(page.getByRole("list", { name: "Quellen" })).toContainText("failed.pdf")
  await expect(page.getByRole("list", { name: "Quellen" })).toContainText("fehlgeschlagen")
  await expect(page.getByText("Erste Orientierung", { exact: true })).toHaveCount(1)
})
