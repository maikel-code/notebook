import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.E2E_PORT ?? "3000")
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `NOTEBOOK_E2E_INGESTION_MODE=1 pnpm dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
  },
})
