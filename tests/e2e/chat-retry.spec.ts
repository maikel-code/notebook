import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

test("keeps a failed attempt, appends the retry, and preserves both after reload", async ({
  page,
}) => {
  const email = `retry-flow-${randomUUID()}@example.test`
  await page.goto("/sign-up")
  await page.getByLabel("E-Mail-Adresse").fill(email)
  await page.getByLabel("Passwort").fill("Local-test-password-42!")
  await page.getByRole("button", { name: "Registrieren" }).click()
  await page.getByLabel("Notebook-Name").fill("Retry")
  await page.getByRole("button", { name: "Notebook anlegen" }).click()
  await page.getByRole("link", { name: "Retry" }).click()

  await page.getByLabel("Frage an das Notebook").fill("Ausfall simulieren")
  await page.getByRole("button", { name: "Frage senden" }).click()
  const attempts = page.getByRole("list", { name: "Antwortversuche" })
  await expect(attempts).toContainText("fehlgeschlagen")
  await page.getByRole("button", { name: "Erneut versuchen" }).click()
  await expect(attempts).toContainText("Versuch 1")
  await expect(attempts).toContainText("Versuch 2")
  await page.reload()
  await expect(attempts).toContainText("Versuch 1")
  await expect(attempts).toContainText("Versuch 2")
})
