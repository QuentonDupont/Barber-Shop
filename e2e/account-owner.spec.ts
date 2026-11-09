import { test, expect, open, signInAs, newVisitor, toast, expectHealthy, SHOP } from "./fixtures";

/**
 * Owner account page (/dashboard/account): personal + shop + owner-only tax
 * details. Handoff 07 tests O1-O4 (O5 is supabase/tests/91_business_legal.sql).
 * English labels. Every test leaves the shop as it found it.
 */

const stamp = () => String(Date.now()).slice(-7);

// 13 digits with a correct Thai check digit / the same with a wrong last digit.
/** Tick "Remove the saved tax ID" if one is saved, so the shop is left as the test found it. */
async function clearSavedTaxId(page: import("@playwright/test").Page) {
  const box = page.locator('input[name="clearTaxId"]');
  if (await box.count()) await box.check();
}

const GOOD_TAX_ID = "1234567890121";
const BAD_TAX_ID = "1234567890122";

test.describe("owner account", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, "owner", baseURL!);
  });

  test("O1: personal and business details together, optional fields marked", async ({ page, snap }) => {
    await open(page, "/dashboard/account");
    await expectHealthy(page);
    await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();

    await expect(page.locator("#fullName")).not.toHaveValue("");
    const email = page.locator("#email");
    await expect(email).not.toHaveValue("");
    await expect(email).toBeDisabled();
    await expect(page.locator("#phone")).toBeVisible();

    await expect(page.locator("#shopName")).not.toHaveValue("");
    // Shop name is required (asterisk); address, LINE, legal name, tax ID, branch, tax address, VAT say "optional".
    await expect(page.locator('label[for="shopName"]')).toContainText("*");
    for (const id of ["address", "lineId", "legalName", "taxId", "branchCode", "taxAddress", "vatRegistered"]) {
      await expect(page.locator(`label[for="${id}"]`)).toContainText("optional");
    }
    await expect(page.getByText("Only needed if you want a full tax invoice")).toBeVisible();
    await expect(page.getByText("Only you can see this.")).toBeVisible();
    await snap(page, "owner account page");
  });

  test("O2: tax details are validated and persist after reload", async ({ page, snap }) => {
    await open(page, "/dashboard/account");
    const original = {
      legalName: await page.locator("#legalName").inputValue(),
      taxId: await page.locator("#taxId").inputValue(),
      branch: await page.locator("#branchCode").inputValue(),
      taxAddress: await page.locator("#taxAddress").inputValue(),
    };
    const legalName = `E2E Co ${stamp()}`;
    const save = () => page.getByRole("button", { name: "Save account" }).click();

    try {
      // Wrong check digit is refused with a message.
      await page.locator("#taxId").fill(BAD_TAX_ID);
      await save();
      await expect(page.getByText("That tax ID is not valid")).toBeVisible();
      await snap(page, "invalid tax id refused");

      // Bad branch code is refused.
      // (React clears the form after every save attempt, so each attempt fills it again.)
      await page.locator("#taxId").fill(GOOD_TAX_ID);
      await page.locator("#branchCode").fill("12");
      await save();
      await expect(page.getByText("Branch code must be 5 digits")).toBeVisible();

      // Valid values save and survive a reload.
      await page.locator("#taxId").fill(GOOD_TAX_ID);
      await page.locator("#branchCode").fill("00001");
      await page.locator("#legalName").fill(legalName);
      await page.locator("#taxAddress").fill("1 Test Road, Bangkok");
      await save();
      await expect(toast(page).filter({ hasText: "Account saved." })).toBeVisible();

      await open(page, "/dashboard/account");
      await expect(page.locator("#legalName")).toHaveValue(legalName);
      // F1: only the last 4 digits come back; the full number is never in the page.
      await expect(page.locator("#taxId")).toHaveValue("");
      await expect(page.getByText("Saved: *********0121")).toBeVisible();
      expect(await page.content()).not.toContain(GOOD_TAX_ID);
      await expect(page.locator("#branchCode")).toHaveValue("00001");
      await expect(page.locator("#taxAddress")).toHaveValue("1 Test Road, Bangkok");
      await snap(page, "tax details saved");
    } finally {
      await open(page, "/dashboard/account");
      await page.locator("#legalName").fill(original.legalName);
      await clearSavedTaxId(page);
      await page.locator("#branchCode").fill(original.branch || "00000");
      await page.locator("#taxAddress").fill(original.taxAddress);
      await page.getByRole("button", { name: "Save account" }).click();
      await expect(toast(page).first()).toBeVisible();
    }
  });

  test("O3: shop details reach the public page, tax details never do", async ({ page, browser, baseURL, snap }) => {
    const visitor = await newVisitor(browser, baseURL!);
    await open(page, "/dashboard/account");
    const originalAddress = await page.locator("#address").inputValue();
    const originalLegal = await page.locator("#legalName").inputValue();
    const address = `${stamp()} E2E Soi 11, Bangkok`;
    const legalName = `Secret Legal ${stamp()} Ltd`;

    try {
      await page.locator("#address").fill(address);
      await page.locator("#legalName").fill(legalName);
      await page.locator("#taxId").fill(GOOD_TAX_ID);
      await page.getByRole("button", { name: "Save account" }).click();
      await expect(toast(page).filter({ hasText: "Account saved." })).toBeVisible();

      await open(visitor.page, `/b/${SHOP}`);
      await expect(visitor.page.getByText(address).first()).toBeVisible();
      const html = await visitor.page.content();
      expect(html).not.toContain(GOOD_TAX_ID);
      expect(html).not.toContain(legalName);
      await snap(visitor.page, "public shop page with new address, no tax data");
    } finally {
      await open(page, "/dashboard/account");
      await page.locator("#address").fill(originalAddress);
      await page.locator("#legalName").fill(originalLegal);
      await clearSavedTaxId(page);
      await page.getByRole("button", { name: "Save account" }).click();
      await expect(toast(page).first()).toBeVisible();
      await visitor.context.close();
    }
  });

  test("O3b: reachable from the account menu and from Settings", async ({ page, snap }) => {
    await open(page, "/dashboard/settings");
    await page.getByRole("link", { name: "Open account" }).click();
    await expect(page).toHaveURL(/\/dashboard\/account$/);

    await open(page, "/dashboard");
    await page.getByRole("button", { name: "Account menu" }).filter({ visible: true }).first().click();
    await snap(page, "account menu with My account");
    await page.getByRole("menuitem", { name: "My account" }).click();
    await expect(page).toHaveURL(/\/dashboard\/account$/);
  });

  test("O4: a customer is redirected away from the owner account page", async ({ browser, baseURL, snap }) => {
    const customer = await newVisitor(browser, baseURL!, "en", "customer");
    try {
      await open(customer.page, "/dashboard/account");
      await expect(customer.page).not.toHaveURL(/\/dashboard\/account/);
      await expect(customer.page.locator("#taxId")).toHaveCount(0);
      await snap(customer.page, "customer redirected");
    } finally {
      await customer.context.close();
    }
  });
});
