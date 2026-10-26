import { defineConfig, devices } from "@playwright/test";

/**
 * TatNat end-to-end suite (handoff 09). Everything runs against the app in
 * mock mode (NEXT_PUBLIC_USE_MOCK=1: in-memory fixtures, no Supabase), so the
 * suite needs nothing but a built app.
 *
 *   npm run build            # with NEXT_PUBLIC_USE_MOCK=1
 *   npm run test:e2e         # starts `next start` itself when nothing is listening
 *
 * Three projects, as the CEO asked: an iPhone-sized WebKit, the same phone
 * size in Chromium, and one desktop Chromium.
 *
 * Why one worker: the mock data lives in the memory of the single `next start`
 * process, so every spec talks to the same shop. Specs are written to leave the
 * shop as they found it (or to use fresh sign-ups / unique names) and the
 * three projects run one after another against the same server.
 */

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

// iPhone 14 is 390x844 @3x. The WebKit project uses it as is. The Chromium
// phone project reuses the same device profile (viewport, touch, user agent)
// but runs it in Chromium.
const iphone = devices["iPhone 14"];
const { defaultBrowserType: _ignored, ...iphoneProfile } = iphone;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e-results/test-output",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    // The HTML report embeds every screenshot the specs attach, so it doubles
    // as a visual walkthrough of the product.
    ["html", { outputFolder: "./e2e-results/html-report", open: "never" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    // Thai is the app's default language; specs choose theirs explicitly.
    timezoneId: "Asia/Bangkok",
  },
  projects: [
    { name: "iphone-webkit", use: { ...devices["iPhone 14"] } },
    { name: "iphone-chromium", use: { ...iphoneProfile, browserName: "chromium" } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  // Reuse a server that is already up (CI starts one explicitly, like the
  // smoke job); otherwise start the production build in mock mode.
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { NEXT_PUBLIC_USE_MOCK: "1", NEXT_PUBLIC_SITE_URL: BASE_URL },
  },
});
