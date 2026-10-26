import fs from "node:fs";
import path from "node:path";
import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

export { expect };

export type Lang = "en" | "th";

/** Mock-mode session cookie: `role:id`, ids fixed in src/lib/mock/fixtures.ts. */
export const OWNER_COOKIE = "business_owner:a0000000-0000-4000-8000-000000000001";
export const CUSTOMER_COOKIE = "customer:a0000000-0000-4000-8000-000000000002";
export const STAFF_NONG = "d0000000-0000-4000-8000-000000000001";
export const STAFF_PLOY = "d0000000-0000-4000-8000-000000000002";
export const SHOP = "nong-barber";

const SHOT_ROOT = path.resolve(process.cwd(), "e2e-results", "screenshots");

export interface Fixtures {
  /** Language cookie set before the first page load. Thai is the app default. */
  lang: Lang;
  /** Full-page screenshot, saved under e2e-results/screenshots and attached to the HTML report. */
  snap: (page: Page, name: string) => Promise<void>;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const test = base.extend<Fixtures>({
  lang: ["en", { option: true }],

  context: async ({ context, lang, baseURL }, use) => {
    await context.addCookies([{ name: "bookly-locale", value: lang, url: baseURL! }]);
    await use(context);
  },

  snap: async ({}, use, testInfo) => {
    let n = 0;
    const dir = path.join(
      SHOT_ROOT,
      testInfo.project.name,
      slug(path.basename(testInfo.file, ".spec.ts")),
      slug(testInfo.title),
    );
    fs.mkdirSync(dir, { recursive: true });
    await use(async (page, name) => {
      n += 1;
      const file = path.join(dir, `${String(n).padStart(2, "0")}-${slug(name)}.png`);
      await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
      await testInfo.attach(`${String(n).padStart(2, "0")} ${name}`, {
        path: file,
        contentType: "image/png",
      });
    });
  },
});

export async function signInAs(context: BrowserContext, who: "owner" | "customer", baseURL: string) {
  await context.addCookies([
    { name: "bookly_mock_user", value: who === "owner" ? OWNER_COOKIE : CUSTOMER_COOKIE, url: baseURL },
  ]);
}

/**
 * Navigate and wait until the page has hydrated. The app is server rendered:
 * a click that lands before hydration is silently lost, which would make
 * every interaction test flaky.
 */
export async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** The Next error boundary and 404 text must never appear on a working screen. */
export async function expectHealthy(page: Page) {
  await expect(page.getByText("Something went wrong on our side")).toHaveCount(0);
  await expect(page.getByText("Application error")).toHaveCount(0);
}

/** Bangkok "today" as YYYY-MM-DD, matching the shop's own time zone. */
export function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function toast(page: Page) {
  return page.locator("[data-sonner-toast]");
}

/** A separate, signed-out visitor (their own cookies), for "what does the customer see" checks. */
export async function newVisitor(
  browser: import("@playwright/test").Browser,
  baseURL: string,
  lang: Lang = "en",
  as?: "customer" | "owner",
) {
  const context = await browser.newContext({ baseURL });
  await context.addCookies([{ name: "bookly-locale", value: lang, url: baseURL }]);
  if (as) await signInAs(context, as, baseURL);
  const page = await context.newPage();
  return { context, page };
}
