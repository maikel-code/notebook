import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

test("register, manage an own notebook, and sign out", async ({ page }) => {
  const email = `e2e-${randomUUID()}@example.test`
  const password = "Local-test-password-42!"

  await page.goto("/notebooks")
  await expect(page).toHaveURL(/\/sign-in/)
  await page.getByRole("link", { name: "Konto anlegen" }).click()
  await expect(page).toHaveURL(/\/sign-up/)
  const registerButton = page.getByRole("button", { name: "Registrieren" })
  await expect(page.locator('form[data-hydrated="true"]')).toBeVisible()
  await page.getByLabel("E-Mail-Adresse").fill(email)
  await page.getByLabel("Passwort").fill(password)
  await registerButton.click()

  await expect(page).toHaveURL(/\/notebooks$/)
  await expect(page.getByText("Noch keine Notebooks")).toBeVisible()

  await expect(page.locator('form:has(#notebook-name)[data-hydrated="true"]')).toBeVisible()
  await page.getByLabel("Notebook-Name").fill("Interview notes")
  await page.getByRole("button", { name: "Notebook anlegen" }).click()
  await page.getByRole("link", { name: "Interview notes" }).click()
  await expect(page).toHaveURL(/\/notebooks\/[0-9a-f-]+$/i)
  const notebookUrl = page.url()

  await expect(page.locator('form:has(#new-notebook-name)[data-hydrated="true"]')).toBeVisible()
  await page.getByLabel("Neuer Notebook-Name").fill("Renamed notes")
  await page.getByRole("button", { name: "Umbenennen" }).click()
  await expect(page.getByRole("heading", { name: "Renamed notes" })).toBeVisible()

  const deleteButton = page.getByRole("button", { name: "Notebook löschen" })
  await expect(deleteButton).toHaveAttribute("data-hydrated", "true")

  await page.getByRole("link", { name: "← Alle Notebooks" }).click()
  await expect(page).toHaveURL(/\/notebooks$/)
  await page.getByRole("button", { name: "Abmelden" }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.goto(notebookUrl)
  await expect(page).toHaveURL(/\/sign-in\?next=/)
  await expect(page.locator('form[data-hydrated="true"]')).toBeVisible()
  await page.getByLabel("E-Mail-Adresse").fill(email)
  await page.getByLabel("Passwort").fill(password)
  await page.getByRole("button", { name: "Anmelden" }).click()
  await expect(page).toHaveURL(notebookUrl)
  await expect(page.getByRole("heading", { name: "Renamed notes" })).toBeVisible()

  await expect(deleteButton).toHaveAttribute("data-hydrated", "true")
  await deleteButton.click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByRole("button", { name: "Endgültig löschen" }).click()
  await expect(page).toHaveURL(/\/notebooks$/)

  await page.getByRole("button", { name: "Abmelden" }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.goto(notebookUrl)
  await expect(page).toHaveURL(/\/sign-in\?next=/)
  await expect(page.getByText("Renamed notes")).toHaveCount(0)
})
