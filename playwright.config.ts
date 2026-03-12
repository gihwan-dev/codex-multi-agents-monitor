import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright",
  fullyParallel: false,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:1420",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 1420",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://127.0.0.1:1420",
  },
  projects: [
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        browserName: "webkit",
        viewport: { width: 1600, height: 960 },
      },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1600, height: 960 },
      },
    },
  ],
});
