import { randomUUID } from "node:crypto"

import { expect, type Page, test } from "@playwright/test"

async function waitForSearch(page: Page): Promise<void> {
  const response = page.waitForResponse(
    (candidate) => candidate.url().includes("/api/web/search") && candidate.status() === 200,
  )
  await page.getByRole("button", { name: "Suchen" }).click()
  await response
}

test("searches, previews and explicitly imports individual and all web source selections", async ({
  page,
}) => {
  const email = `web-source-${randomUUID()}@example.test`
  await page.goto("/sign-up")
  await page.getByLabel("E-Mail-Adresse").fill(email)
  await page.getByLabel("Passwort").fill("Local-test-password-42!")
  await page.getByRole("button", { name: "Registrieren" }).click()
  await page.getByLabel("Notebook-Name").fill("Webquellen")
  await page.getByRole("button", { name: "Notebook anlegen" }).click()
  await page.getByRole("link", { name: "Webquellen" }).click()

  await page.getByLabel("Webquellen durchsuchen").fill("Mitgliedschaft")
  await waitForSearch(page)
  await expect(page.getByRole("list", { name: "Websuchergebnisse" })).toContainText(
    "Öffentliche Beispielquelle",
  )
  await page.getByRole("button", { name: "Vorschau anzeigen" }).first().click()
  await expect(page.getByRole("region", { name: "Webquellenvorschau" })).toContainText(
    "https://example.org/source",
  )
  await expect(page.getByRole("link", { name: "Originalwebseite öffnen" })).toHaveAttribute(
    "href",
    "https://example.org/source",
  )

  await page.reload()
  await expect(page.getByText("Noch keine Quellen aufgenommen.")).toBeVisible()

  await page.getByLabel("Webquellen durchsuchen").fill("Mitgliedschaft")
  await waitForSearch(page)
  await page.getByRole("checkbox").first().check()
  await page.getByRole("button", { name: "Auswahl bestätigen und übernehmen" }).click()
  await expect(page.getByRole("list", { name: "Quellen" })).toContainText("bereit")
  await expect(page.getByRole("list", { name: "Quellen" })).toContainText(
    "Öffentliche Beispielquelle",
  )
  await expect(page.getByRole("list", { name: "Websuchergebnisse" })).toHaveCount(0)

  await page.getByLabel("Webquellen durchsuchen").fill("Mitgliedschaft")
  await waitForSearch(page)
  await page.getByRole("button", { name: "Alle angezeigten auswählen" }).click()
  await expect(page.getByRole("checkbox").first()).toBeChecked()
  await page.getByRole("button", { name: "Auswahl bestätigen und übernehmen" }).click()
  await expect(page.getByRole("list", { name: "Quellen" })).toContainText("fehlgeschlagen")
})
