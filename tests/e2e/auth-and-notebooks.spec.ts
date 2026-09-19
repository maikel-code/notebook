import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

test("register, manage an own notebook, and sign out", async ({ page }) => {
  const email = `e2e-${randomUUID()}@example.test`
  const password = "Local-test-password-42!"

  await page.goto("/notebooks")
  await expect(page).toHaveURL(/\/sign-in/)
  await page.getByRole("link", { name: "Konto anlegen" }).click()
  const registerButton = page.getByRole("button", { name: "Registrieren" })
  await expect(registerButton).toBeEnabled()
  await page.getByLabel("E-Mail-Adresse").fill(email)
  await page.getByLabel("Passwort").fill(password)
  await registerButton.click()

  await expect(page).toHaveURL(/\/notebooks$/)
  await expect(page.getByText("Noch keine Notebooks")).toBeVisible()

  await page.getByLabel("Notebook-Name").fill("Interview notes")
  await page.getByRole("button", { name: "Notebook anlegen" }).click()
  await page.getByRole("link", { name: "Interview notes" }).click()
  const notebookUrl = page.url()

  await page.getByLabel("Neuer Notebook-Name").fill("Renamed notes")
  await page.getByRole("button", { name: "Umbenennen" }).click()
  await expect(page.getByRole("heading", { name: "Renamed notes" })).toBeVisible()

  await page.getByRole("button", { name: "Notebook löschen" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByRole("button", { name: "Endgültig löschen" }).click()
  await expect(page).toHaveURL(/\/notebooks$/)

  await page.getByRole("button", { name: "Abmelden" }).click()
  await page.goto(notebookUrl)
  await expect(page).toHaveURL(/\/sign-in/)
  await expect(page.getByText("Renamed notes")).toHaveCount(0)

  const signInButton = page.getByRole("button", { name: "Anmelden" })
  await expect(signInButton).toBeEnabled()
  await page.getByLabel("E-Mail-Adresse").fill(email)
  await page.getByLabel("Passwort").fill(password)
  await signInButton.click()
  await expect(page).toHaveURL(/\/notebooks$/)
  await expect(page.getByText("Noch keine Notebooks")).toBeVisible()
})
