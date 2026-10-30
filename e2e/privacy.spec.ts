import fs from "node:fs";
import { test, expect, open, toast, expectHealthy } from "./fixtures";
import { openShop, pickNextOpenDay, reviewFirstSlot } from "./booking";
import type { Page } from "@playwright/test";

/** PDPA: the privacy policy page and the account page's "Your data" section. */

/** A brand-new customer who ticked the consent box, signed in and on /app. */
async function newCustomer(page: Page) {
  const email = `privacy-${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  await open(page, "/sign-up");
  await page.locator("#fullName").fill("Privacy Tester");
  await page.locator("#email").fill(email);
  await page.locator("#phone").fill("081 234 5678");
  await page.locator("#password").fill("longenough1");
  await page.locator("#consent").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.waitForLoadState("networkidle");
}

async function withdrawConsent(page: Page) {
  await open(page, "/app/account");
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("withdraws your consent");
    void dialog.accept();
  });
  await page.getByRole("button", { name: "Withdraw consent" }).click();
  await expect(toast(page).filter({ hasText: "Consent withdrawn." })).toBeVisible();
  await expect(page.getByText(/^Withdrawn on /)).toBeVisible();
}

test.describe("privacy", () => {
  test("the privacy policy renders in Thai and in English", async ({ page, context, baseURL, snap }) => {
    await context.addCookies([{ name: "tatnat-locale", value: "th", url: baseURL! }]);
    await open(page, "/privacy");
    await expectHealthy(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(page.getByRole("heading", { name: "นโยบายความเป็นส่วนตัว" })).toBeVisible();
    await expect(page.getByText(/เวอร์ชันนโยบาย: \S+/)).toBeVisible();
    await expect(page.getByText("ข้อมูลที่เราเก็บ")).toBeVisible();
    await expect(page.getByText("สิทธิของคุณ")).toBeVisible();
    await expect(page.getByText("What we collect")).toHaveCount(0);
    await snap(page, "privacy policy in Thai");

    await page.getByRole("button", { name: "EN" }).click();
    await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText(/Policy version: \S+/)).toBeVisible();
    await expect(page.getByText("What we collect")).toBeVisible();
    await expect(page.getByText("Your rights")).toBeVisible();
    await expect(page.getByText("Draft — pending Legal review.")).toBeVisible();
    await expect(page.getByText("ข้อมูลที่เราเก็บ")).toHaveCount(0);
    await snap(page, "privacy policy in English");
  });

  test("account page 'Your data': download, request deletion and withdraw consent", async ({ page, snap }) => {
    await newCustomer(page);
    await open(page, "/app/account");
    await expect(page.getByText("Your data", { exact: true })).toBeVisible();
    await expect(page.getByText("Consent given")).toBeVisible();
    await expect(page.getByText(/Policy version \S+ · agreed /)).toBeVisible();
    await expect(page.getByRole("link", { name: "View the privacy policy" })).toHaveAttribute("href", "/privacy");
    await snap(page, "your data: consent given");

    // Download: a JSON file with this user's own data.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download my data" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^tatnat-my-data-.+\.json$/);
    const file = await download.path();
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(data.profile.full_name).toBe("Privacy Tester");
    expect(data.consentRecords).toHaveLength(1);
    expect(Array.isArray(data.bookings)).toBe(true);
    await expect(toast(page).filter({ hasText: "Your data file has downloaded." })).toBeVisible();
    await snap(page, "data downloaded");

    // Withdraw consent.
    await withdrawConsent(page);
    await expect(page.getByRole("button", { name: "Give consent again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Withdraw consent" })).toHaveCount(0);
    await snap(page, "consent withdrawn");

    // Request deletion.
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("delete your account and data");
      void dialog.accept();
    });
    await page.getByRole("button", { name: "Request deletion" }).click();
    await expect(toast(page).filter({ hasText: "Deletion requested." })).toBeVisible();
    await expect(page.getByText(/Deletion requested on .* — pending\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Request deletion" })).toHaveCount(0);
    await snap(page, "deletion requested");
  });

  test("after withdrawing consent a booking is blocked with the right message, and works again after consenting", async ({ page, snap }) => {
    await newCustomer(page);
    await withdrawConsent(page);
    await snap(page, "consent withdrawn on the account page");

    await openShop(page, "Men's cut");
    await pickNextOpenDay(page);
    const dialog = await reviewFirstSlot(page);
    await dialog.getByRole("button", { name: "Confirm booking" }).click();

    const blocked = toast(page).filter({
      hasText: "Your data consent is withdrawn, so new bookings are paused. Visit Account > Your data to consent again.",
    });
    await expect(blocked).toBeVisible();
    await expect(page).not.toHaveURL(/\/app\/bookings/);
    await snap(page, "booking blocked: consent withdrawn");

    // The toast offers a direct way out.
    const clicked = await blocked
      .getByRole("button", { name: "Go to account" })
      .click({ timeout: 5000 })
      .then(() => true, () => false);
    expect.soft(clicked, 'the "Go to account" button in the blocked-booking toast can be clicked while the confirm sheet is open').toBe(true);
    if (!clicked) await open(page, "/app/account");
    await expect(page).toHaveURL(/\/app\/account/);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Give consent again" }).click();
    await expect(toast(page).filter({ hasText: "your consent is recorded" })).toBeVisible();
    await expect(page.getByText("Consent given")).toBeVisible();

    // Now the same booking goes through.
    await openShop(page, "Men's cut");
    await pickNextOpenDay(page);
    const again = await reviewFirstSlot(page);
    await again.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page).toHaveURL(/\/app\/bookings/);
    await snap(page, "booking works again after consenting");
  });
});
