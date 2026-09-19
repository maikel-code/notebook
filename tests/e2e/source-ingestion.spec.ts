import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

test("source upload shows a clear rejection without a page reload", async ({ page }) => {
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
    buffer: Buffer.from("not a PDF"),
    mimeType: "image/png",
    name: "not-a-pdf.png",
  })
  await expect(page.locator("#source-upload-error")).toContainText("hochgeladen")
})
