import { test, expect, open, signInAs, newVisitor, toast, expectHealthy, SHOP } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * Owner billing screens (handoff 07, demo data only). The shop starts on Pro
 * with three receipts and a demo card. Every test that changes the plan puts
 * it back on Pro, so the other specs find the shop as they expect it.
 */

const BILLING = "/dashboard/account/billing";
const stamp = () => String(Date.now()).slice(-7);

async function currentPlan(page: Page): Promise<string> {
  return ((await page.getByTestId("current-plan-name").textContent()) ?? "").trim();
}

/** Open the plan sheet for `plan`, tick the renewal box, confirm, and wait for the result. */
async function changePlan(page: Page, plan: "free" | "pro" | "studio", opts: { founding?: boolean } = {}) {
  await open(page, BILLING);
  await page.getByTestId(`choose-${plan}`).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByTestId("change-preview")).toBeVisible();
  const consent = sheet.locator('input[name="consent"]');
  if (await consent.count()) await consent.check();
  if (opts.founding) await sheet.locator('input[name="founding"]').check();
  await sheet.getByTestId("confirm-plan").click();
  await expect(toast(page).filter({ hasText: /You are now on|ตอนนี้|แล้ว/ }).first()).toBeVisible();
}

async function ensureOn(page: Page, plan: "free" | "pro") {
  await open(page, BILLING);
  // A test that failed half way may have left the shop in a notice state: put it right first.
  if (await page.getByTestId(/billing-notice-(past_due|grace|downgraded)/).count()) {
    await page.getByTestId("scenario-reset").click();
    await expect(toast(page).filter({ hasText: "Simulation applied." })).toBeVisible();
    await open(page, BILLING);
  }
  const name = plan === "pro" ? "Pro" : "Free";
  if ((await currentPlan(page)) !== name) await changePlan(page, plan);
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(1);
}

test.describe("owner billing", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, "owner", baseURL!);
  });

  test("plan and billing page: plan, usage, demo banner, receipts and the receipt view in both languages", async ({ page, snap }) => {
    await ensureOn(page, "pro");
    await open(page, BILLING);
    await expectHealthy(page);

    await expect(page.getByRole("heading", { name: "Plan & billing", level: 1 })).toBeVisible();
    await expect(page.getByTestId("demo-banner")).toContainText("Demo — no real charges");
    await expect(page.getByTestId("current-plan-name")).toHaveText("Pro");
    await expect(page.getByTestId("barber-usage")).toHaveText(/^\d+ of 5 barbers$/);
    // F4: only shipped features are listed as plain facts; anything future carries a "Soon" tag.
    await expect(page.getByTestId("plan-card-free")).not.toContainText("LINE");
    await expect(page.getByTestId("plan-card-pro")).toContainText("LINE reminders and messages to customers");
    await expect(page.getByTestId("plan-card-pro").getByText("Soon", { exact: true })).toBeVisible();
    await expect(page.getByTestId("plan-card-studio").getByText("Soon", { exact: true })).toBeVisible();
    await expect(page.getByTestId("next-charge")).not.toBeEmpty();
    await expect(page.getByTestId("payment-method")).toContainText("Visa ending 4242");
    await expect(page.getByTestId("payment-method")).toContainText("Demo card");
    await noSidewaysScroll(page);
    await snap(page, "plan and billing");

    // Targets are at least 44px tall.
    for (const id of ["choose-free", "choose-studio"]) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box!.height, id).toBeGreaterThanOrEqual(44);
    }
    const rowBox = await page.getByTestId("invoice-row").first().boundingBox();
    expect(rowBox!.height).toBeGreaterThanOrEqual(44);

    // Receipts: at least the three demo ones, newest first, each a link to its own page.
    const rows = page.getByTestId("invoice-row");
    expect(await rows.count()).toBeGreaterThanOrEqual(3);
    await expect(rows.first()).toContainText(/TN-\d{4}-\d{6}/);
    await snap(page, "receipt list");

    await rows.first().click();
    await expect(page.getByTestId("receipt")).toBeVisible();
    await expect(page.getByTestId("demo-banner")).toBeVisible();
    await expect(page.getByTestId("receipt-title")).toHaveText("Receipt");
    await expect(page.getByTestId("receipt-number")).toHaveText(/^TN-\d{4}-\d{6}$/);
    await expect(page.getByTestId("receipt-total")).toHaveText(/^THB [\d,]+\.\d{2}$/);
    await expect(page.getByTestId("receipt")).toContainText("Pro plan, monthly");
    await expect(page.getByTestId("receipt")).toContainText("Not VAT registered");
    await noSidewaysScroll(page);
    await snap(page, "receipt in English");

    // The same receipt data in Thai: Thai labels and a Buddhist-era date.
    await page.getByTestId("receipt-lang-switch").click();
    await expect(page.getByTestId("receipt-title")).toHaveText("ใบเสร็จรับเงิน");
    await expect(page.getByTestId("receipt-date")).toHaveText(/25\d\d$/);
    await expect(page.getByTestId("receipt-total")).toHaveText(/บาท$/);
    await snap(page, "receipt in Thai");
  });

  test("the owner account page links to plan and billing with the current plan on it", async ({ page }) => {
    await ensureOn(page, "pro");
    await open(page, "/dashboard/account");
    const link = page.getByTestId("billing-link");
    await expect(link).toContainText("Plan & billing");
    await expect(link).toContainText(/Pro · \d+ of 5 barbers/);
    await Promise.all([page.waitForURL(/\/dashboard\/account\/billing$/), link.click()]);
    await expect(page.getByRole("heading", { name: "Plan & billing", level: 1 })).toBeVisible();
  });

  test("plan change: Pro to Studio and back, then the founding offer when it is still available", async ({ page, snap }) => {
    await ensureOn(page, "pro");
    await open(page, BILLING);
    const before = await page.getByTestId("invoice-row").count();

    // Upgrade: the sheet says what is charged and that it is a demo.
    await page.getByTestId("choose-studio").click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByTestId("change-preview")).toContainText("THB 990.00");
    await expect(sheet.getByTestId("change-preview")).toContainText("demo card");
    // The renewal box starts unticked and is required.
    await expect(sheet.locator('input[name="consent"]')).not.toBeChecked();
    await sheet.getByTestId("confirm-plan").click();
    await expect(sheet.getByText("Tick the renewal box first.")).toBeVisible();
    await snap(page, "upgrade sheet needs consent");
    await sheet.locator('input[name="consent"]').check();
    await sheet.getByTestId("confirm-plan").click();
    await expect(toast(page).filter({ hasText: "You are now on Studio." })).toBeVisible();
    await expect(page.getByTestId("current-plan-name")).toHaveText("Studio");
    await expect(page.getByTestId("barber-usage")).toHaveText(/^\d+ of 15 barbers$/);
    await expect(page.getByTestId("invoice-row")).toHaveCount(before + 1);
    await snap(page, "now on Studio");

    // Studio to Pro is a downgrade that keeps everyone while they fit.
    await page.getByTestId("choose-pro").click();
    await expect(page.getByRole("dialog").getByTestId("change-preview")).toContainText("THB 490.00");
    await page.getByRole("dialog").locator('input[name="consent"]').check();
    await page.getByTestId("confirm-plan").click();
    await expect(toast(page).filter({ hasText: "You are now on Pro." })).toBeVisible();
    await expect(page.getByTestId("current-plan-name")).toHaveText("Pro");

    // Founding offer: only while it is available to this shop. Free, then Pro with the offer.
    await changePlan(page, "free");
    await expect(page.getByTestId("current-plan-name")).toHaveText("Free");
    await expect(page.getByTestId("next-charge")).toHaveText("Nothing to pay");
    if (await page.getByTestId("founding-offer").count()) {
      await snap(page, "founding offer shown");
      const invoicesBefore = await page.getByTestId("invoice-row").count();
      await page.getByTestId("choose-pro").click();
      const s = page.getByRole("dialog");
      await s.locator('input[name="founding"]').check();
      await expect(s.getByTestId("change-preview")).toContainText("Nothing is charged for the first 3 months.");
      await s.locator('input[name="consent"]').check();
      await s.getByTestId("confirm-plan").click();
      await expect(toast(page).filter({ hasText: "You are now on Pro." })).toBeVisible();
      await expect(page.getByText("Founding shop", { exact: true })).toBeVisible();
      await expect(page.getByTestId("founding-note")).toContainText("THB 290");
      await expect(page.getByTestId("invoice-row")).toHaveCount(invoicesBefore); // free months: no receipt
      await snap(page, "founding shop");
    } else {
      await changePlan(page, "pro");
    }
    await expect(page.getByTestId("current-plan-name")).toHaveText("Pro");
  });

  test("barber limit: a downgrade asks who stays, and a full plan says so in plain words", async ({ page, browser, baseURL, snap }) => {
    const extra = `Limit Barber ${stamp()}`;
    await ensureOn(page, "pro");

    // A third barber on Pro (limit 5).
    await open(page, "/dashboard/staff");
    await page.getByRole("button", { name: "Add staff member" }).click();
    let sheet = page.getByRole("dialog");
    await sheet.locator("#staff-name").fill(extra);
    await sheet.getByRole("button", { name: "Add staff member" }).click();
    await expect(toast(page).filter({ hasText: "Staff member added." })).toBeVisible();

    // Downgrade to Free: three active barbers, two fit, so the owner chooses.
    await open(page, BILLING);
    await page.getByTestId("choose-free").click();
    sheet = page.getByRole("dialog");
    const picker = sheet.getByTestId("barber-picker");
    await expect(picker).toBeVisible();
    await expect(picker).toContainText("Choose the 2 barbers who stay bookable");
    await expect(picker).toContainText("nothing is deleted");
    await expect(sheet.getByTestId("confirm-plan")).toBeEnabled();
    await picker.getByLabel(extra).check(); // three ticked: more than fit
    await expect(sheet.getByTestId("confirm-plan")).toBeDisabled();
    await picker.getByLabel(extra).uncheck();
    await snap(page, "choose who stays");
    await sheet.getByTestId("confirm-plan").click();
    await expect(toast(page).filter({ hasText: "You are now on Free." })).toBeVisible();
    await expect(page.getByTestId("barber-usage")).toHaveText("2 of 2 barbers");
    await expect(page.getByTestId("billing-notice-downgraded")).toHaveCount(1);
    await snap(page, "back on Free");

    // The hidden barber is still on the staff list, inactive. Switching it on is refused, kindly.
    await open(page, "/dashboard/staff");
    const card = page.locator("div.rounded-xl").filter({ has: page.getByText(extra, { exact: true }) });
    await expect(card.getByText("Deactivated").first()).toBeVisible();
    await card.getByRole("switch", { name: new RegExp(`Activate ${extra}`) }).click();
    const refusal = toast(page).filter({ hasText: "allows up to 2 barbers" });
    await expect(refusal).toBeVisible();
    await expect(refusal).not.toContainText("staff_limit_exceeded");
    await expect(refusal).toContainText("Upgrade your plan");
    await snap(page, "re-activation refused");
    await expect(card.getByText("Deactivated").first()).toBeVisible();

    // Adding a new one is refused too, with a link to the plans.
    await page.getByRole("button", { name: "Add staff member" }).click();
    sheet = page.getByRole("dialog");
    await sheet.locator("#staff-name").fill(`${extra} 2`);
    await sheet.getByRole("button", { name: "Add staff member" }).click();
    const alert = sheet.getByRole("alert");
    await expect(alert).toContainText("allows up to 2 barbers");
    await expect(alert).not.toContainText("staff_limit_exceeded");
    await snap(page, "adding a barber refused");
    await expect(alert.getByRole("link", { name: "See plans" })).toBeVisible();

    // Customers are unaffected: the shop page still works and shows no billing wording.
    const visitor = await newVisitor(browser, baseURL!);
    try {
      await open(visitor.page, `/b/${SHOP}`);
      await expect(visitor.page.getByRole("heading", { name: /Nong Barber/i }).first()).toBeVisible();
      await expect(visitor.page.locator("body")).not.toContainText(/Free plan|Plan & billing|barber limit/i);
    } finally {
      await visitor.context.close();
    }

    // Back to Pro; the hidden barber can be switched on again, then off to tidy up.
    await changePlan(page, "pro");
    await open(page, "/dashboard/staff");
    const again = page.locator("div.rounded-xl").filter({ has: page.getByText(extra, { exact: true }) });
    await again.getByRole("switch", { name: new RegExp(`Activate ${extra}`) }).click();
    await expect(again.getByText("Active", { exact: true }).first()).toBeVisible();
    // Tidy up from a fresh page, so the second switch does not race the first one's refresh.
    await open(page, "/dashboard/staff");
    const last = page.locator("div.rounded-xl").filter({ has: page.getByText(extra, { exact: true }) });
    await last.getByRole("switch", { name: new RegExp(`Deactivate ${extra}`) }).click();
    await expect(last.getByText("Deactivated").first()).toBeVisible();
  });

  test("owner notices: payment declined, grace period, back on Free, and reset", async ({ page, browser, baseURL, snap }) => {
    await ensureOn(page, "pro");
    await open(page, BILLING);

    await page.getByTestId("scenario-failed").click();
    await expect(page.getByTestId("billing-notice-past_due")).toBeVisible();
    await expect(page.getByTestId("billing-notice-past_due")).toContainText("customers can still book your shop");
    await expect(page.getByTestId("billing-notice-past_due").getByTestId("notice-demo-tag")).toHaveText("Demo");
    await expect(page.getByTestId("demo-banner")).toBeVisible();
    await snap(page, "payment declined notice");

    // The notice follows the owner around the dashboard, with a way back to billing.
    await open(page, "/dashboard");
    await expect(page.getByTestId("billing-notice-past_due")).toBeVisible();
    await expect(page.getByTestId("billing-notice-past_due").getByRole("link", { name: "Go to plan & billing" })).toBeVisible();

    // A customer sees nothing at all.
    const visitor = await newVisitor(browser, baseURL!);
    try {
      await open(visitor.page, `/b/${SHOP}`);
      await expect(visitor.page.locator("body")).not.toContainText(/Payment did not go through|grace period|Plan & billing/i);
      await expect(visitor.page.getByRole("heading", { name: /Nong Barber/i }).first()).toBeVisible();
    } finally {
      await visitor.context.close();
    }

    await open(page, BILLING);
    await page.getByTestId("scenario-grace").click();
    await expect(page.getByTestId("billing-notice-grace")).toBeVisible();
    await expect(page.getByTestId("billing-notice-grace")).toContainText(/Nothing is deleted/);
    await expect(page.getByTestId("current-plan-name")).toHaveText("Pro"); // paid extras keep working in grace
    await snap(page, "grace period notice");

    await page.getByTestId("scenario-lapsed").click();
    await expect(page.getByTestId("billing-notice-downgraded")).toBeVisible();
    await expect(page.getByTestId("current-plan-name")).toHaveText("Free");
    await expect(page.getByTestId("billing-notice-downgraded")).toContainText("unchanged");
    await snap(page, "back on Free after non-payment");

    await page.getByTestId("scenario-reset").click();
    await expect(page.getByTestId("current-plan-name")).toHaveText("Pro");
    await expect(page.getByTestId("billing-notice-downgraded")).toHaveCount(0);
    await expect(page.getByTestId("billing-notice-past_due")).toHaveCount(0);
  });

  test("cancelling at the end of the period can be undone", async ({ page, snap }) => {
    await ensureOn(page, "pro");
    await open(page, BILLING);
    await page.getByTestId("cancel-plan").click();
    await expect(toast(page).filter({ hasText: "Cancellation set." })).toBeVisible();
    await expect(page.getByTestId("billing-notice-cancelling")).toBeVisible();
    await snap(page, "cancellation set");
    await page.getByTestId("undo-cancel").click();
    await expect(toast(page).filter({ hasText: "Cancellation removed." })).toBeVisible();
    await expect(page.getByTestId("billing-notice-cancelling")).toHaveCount(0);
  });

  test("demo card: add and remove with one click, no card number typed", async ({ page }) => {
    await ensureOn(page, "pro");
    await open(page, BILLING);
    const card = page.getByTestId("payment-method");
    // Hidden inputs are the form plumbing; there must be no field a card number could go in.
    await expect(card.locator("input:not([type=hidden])")).toHaveCount(0);
    await card.getByTestId("remove-card").click();
    await expect(card).toContainText("No card yet");
    await card.getByTestId("add-card").click();
    await expect(card).toContainText("Visa ending 4242");
  });
});

test.describe("billing in Thai", () => {
  test.use({ lang: "th" });

  test("the billing page and a receipt are Thai first", async ({ page, context, baseURL, snap }) => {
    await signInAs(context, "owner", baseURL!);
    await open(page, BILLING);
    await expect(page.getByRole("heading", { name: "แพ็กเกจและการชำระเงิน", level: 1 })).toBeVisible();
    await expect(page.getByTestId("demo-banner")).toContainText("ตัวอย่าง — ไม่มีการเรียกเก็บเงินจริง");
    await expect(page.getByTestId("barber-usage")).toContainText("ช่าง");
    await expect(page.getByTestId("choose-free")).toContainText("ฟรี");
    await noSidewaysScroll(page);
    await snap(page, "Thai plan and billing");
    await Promise.all([page.waitForURL(/\/billing\/invoices\//), page.getByTestId("invoice-row").first().click()]);
    await expect(page.getByTestId("receipt-title")).toHaveText("ใบเสร็จรับเงิน");
    await expect(page.getByTestId("receipt-date")).toHaveText(/25\d\d$/);
    await snap(page, "Thai receipt");
  });
});

test.describe("customers never see billing", () => {
  test("no billing wording on any customer screen, and no way into the owner billing pages", async ({ browser, baseURL, snap }) => {
    const visitor = await newVisitor(browser, baseURL!, "en", "customer");
    const { page } = visitor;
    const BILLING_WORDS = /Plan & billing|Demo — no real charges|Receipts|Payment method|grace period|barber limit|Upgrade to|founding/i;
    try {
      for (const url of ["/app", "/app/account", "/app/bookings", `/b/${SHOP}`, "/discover"]) {
        const response = await page.goto(url);
        await page.waitForLoadState("networkidle");
        if (response && response.status() >= 400) continue; // a route this build does not have
        await expect(page.locator("body"), url).not.toContainText(BILLING_WORDS);
      }
      await open(page, "/app/account");
      await snap(page, "customer account has no billing");

      // The owner billing pages send a customer to their own app.
      await page.goto(BILLING);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/app(\/|$)/);
      await expect(page.locator("body")).not.toContainText(BILLING_WORDS);
      await page.goto(`${BILLING}/invoices/inv-demo-1`);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/app(\/|$)/);
    } finally {
      await visitor.context.close();
    }

    // A signed-out visitor cannot open them either.
    const anon = await newVisitor(browser, baseURL!);
    try {
      await anon.page.goto(BILLING);
      await anon.page.waitForLoadState("networkidle");
      expect(new URL(anon.page.url()).pathname).toBe("/sign-in");
      await expect(anon.page.locator("body")).not.toContainText(/Demo — no real charges|Receipts/);
    } finally {
      await anon.context.close();
    }
  });
});
