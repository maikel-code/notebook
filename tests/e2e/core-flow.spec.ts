import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

test("uploads a source, streams verified claim paragraphs, and opens their PDF citations", async ({
  page,
}) => {
  const email = `core-flow-${randomUUID()}@example.test`
  await page.goto("/sign-up")
  await page.getByLabel("E-Mail-Adresse").fill(email)
  await page.getByLabel("Passwort").fill("Local-test-password-42!")
  await page.getByRole("button", { name: "Registrieren" }).click()
  await page.getByLabel("Notebook-Name").fill("Citations")
  await page.getByRole("button", { name: "Notebook anlegen" }).click()
  await page.getByRole("link", { name: "Citations" }).click()

  await page
    .getByLabel("PDF-Quelle hinzufügen")
    .setInputFiles("eval/dataset/documents/team-handbook-de.pdf")
  await expect(page.getByRole("list", { name: "Quellen" })).toContainText("bereit")
  await page
    .getByLabel("Frage an das Notebook")
    .fill("An wie vielen Tagen findet Präsenzarbeit statt?")
  await page.getByRole("button", { name: "Frage senden" }).click()
  await expect(page.getByText("wird geprüft")).toBeVisible()
  const citation = page.getByRole("button", { name: /Quelle:.*Seite 1/i })
  await expect(citation).toBeVisible()
  await citation.click()
  await expect(page.getByRole("dialog", { name: "Quelle anzeigen" })).toContainText("Seite 1")
})
