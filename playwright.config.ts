import { defineConfig, devices } from "@playwright/test";

// Own ports, so the smoke test never talks to a service or builder you already have running.
const servicePort = 3100;
const webPort = 5174;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    // In CI a failing test keeps its trace and screenshot, which the workflow uploads. Locally
    // nothing is recorded; rerun with --trace on to debug.
    trace: process.env.CI ? "retain-on-failure" : "off",
    screenshot: process.env.CI ? "only-on-failure" : "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run service",
      url: `http://127.0.0.1:${servicePort}/health`,
      // Fixed so a developer's shell can't change the binding or move orders along mid-test.
      env: {
        PORT: String(servicePort),
        HOST: "127.0.0.1",
        ALLOWED_ORIGINS: `http://127.0.0.1:${webPort}`,
        KITCHEN_AUTO_ADVANCE_SECONDS: "0",
        KITCHEN_SECONDS_TO_START: "",
        KITCHEN_SECONDS_TO_READY: "",
        KITCHEN_SECONDS_TO_DELIVER: "",
      },
      reuseExistingServer: false,
    },
    {
      command: `npm run dev -w @pizza/web -- --host 127.0.0.1 --port ${webPort} --strictPort`,
      url: `http://127.0.0.1:${webPort}`,
      env: { SERVICE_URL: `http://127.0.0.1:${servicePort}` },
      reuseExistingServer: false,
    },
  ],
});
