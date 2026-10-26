import { test, expect, open, signInAs, newVisitor, toast, expectHealthy, SHOP, STAFF_PLOY } from "./fixtures";
import { chooseBarber, openShop, pickNextOpenDay, reviewFirstSlot } from "./booking";
import type { Page } from "@playwright/test";

/** Shop owner flow: Today, Calendar, Staff, Services, Hours, Settings. English labels. */

const stamp = () => String(Date.now()).slice(-7);

test.describe("owner", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, "owner", baseURL!);
  });

  test("Today shows the day's numbers and schedule", async ({ page, snap }) => {
    await open(page, "/dashboard");
    await expectHealthy(page);
    await expect(page.getByRole("heading", { name: /^Today, \d+ \w+/ })).toBeVisible();
    await expect(page.getByText("Nong Barber · times shown in Asia/Bangkok")).toBeVisible();
    for (const label of ["Today", "To confirm", "Expected"]) {
      await expect(page.getByText(label, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }
    await expect(page.getByText("Today’s schedule")).toBeVisible();
    // The three walk-in bookings seeded for today.
    for (const customer of ["Somchai Prasert", "Malee Thongdee", "Anucha Kitti"]) {
      await expect(page.getByText(customer).filter({ visible: true }).first()).toBeVisible();
    }
    await expect(page.getByText("Coming up")).toBeVisible();
    await snap(page, "today");
  });

  test("Calendar: the barber filter narrows the bookings, and a customer's named booking shows under that barber", async ({ page, browser, baseURL, snap }) => {
    await open(page, "/dashboard/calendar");
    await expectHealthy(page);
    await expect(page.getByText("Somchai Prasert").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("3 bookings").filter({ visible: true }).first()).toBeVisible();
    await snap(page, "calendar, all staff");

    // Filter to Ploy: the three seeded walk-ins have no barber on them, so they drop out.
    await page.getByRole("combobox", { name: "Filter by staff" }).click();
    await page.getByRole("option", { name: "Ploy" }).click();
    await expect(page).toHaveURL(new RegExp(`staff=${STAFF_PLOY}`));
    await expect(page.getByText("No bookings on this day")).toBeVisible();
    await expect(page.getByText("Somchai Prasert")).toHaveCount(0);
    await snap(page, "calendar filtered to Ploy");

    // Back to everyone.
    await page.getByRole("combobox", { name: "Filter by staff" }).click();
    await page.getByRole("option", { name: "All staff" }).click();
    await expect(page.getByText("Somchai Prasert").filter({ visible: true }).first()).toBeVisible();

    // A customer books Ploy; the owner finds it under Ploy's filter on that day.
    const customer = await newVisitor(browser, baseURL!, "en", "customer");
    try {
      await openShop(customer.page, "Men's cut");
      await chooseBarber(customer.page, "Ploy");
      const day = await pickNextOpenDay(customer.page, { weekdayIn: [1, 2, 3, 4, 5] });
      const dialog = await reviewFirstSlot(customer.page);
      await dialog.getByRole("button", { name: "Confirm booking" }).click();
      await expect(customer.page).toHaveURL(/\/app\/bookings/);

      await open(page, `/dashboard/calendar?date=${day}&staff=${STAFF_PLOY}`);
      await expect(page.getByText("Ann Suwannee").filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText("Men's cut").filter({ visible: true }).first()).toBeVisible();
      await snap(page, `Ploy's booking on ${day}`);

      // Tidy up: the customer cancels it again.
      await customer.page.waitForLoadState("networkidle");
      await customer.page.getByRole("button", { name: /Men's cut · .* · Ploy/ }).first().click();
      await customer.page.getByRole("dialog").getByRole("button", { name: "Cancel this booking" }).click();
      await expect(toast(customer.page).filter({ hasText: "Booking cancelled." })).toBeVisible();
    } finally {
      await customer.context.close();
    }
  });

  test("Staff: add, edit and deactivate a barber, and the customer's list follows", async ({ page, browser, baseURL, snap }) => {
    const name = `E2E Barber ${stamp()}`;
    const renamed = `${name} Jr`;
    const visitor = await newVisitor(browser, baseURL!);
    const customerSees = async () => {
      await open(visitor.page, `/b/${SHOP}`);
      return visitor.page.locator('section[aria-labelledby="pick-staff"]');
    };

    try {
      await open(page, "/dashboard/staff");
      await expectHealthy(page);
      await expect(page.getByText("Nong", { exact: true })).toBeVisible();
      await expect(page.getByText("Ploy", { exact: true })).toBeVisible();
      await snap(page, "staff list");

      // Add.
      await page.getByRole("button", { name: "Add staff member" }).click();
      const sheet = page.getByRole("dialog");
      await expect(sheet.getByText("Add a staff member")).toBeVisible();
      await sheet.locator("#staff-name").fill(name);
      await snap(page, "add staff sheet");
      await sheet.getByRole("button", { name: "Add staff member" }).click();
      await expect(toast(page).filter({ hasText: "Staff member added." })).toBeVisible();
      await expect(page.getByText(name, { exact: true })).toBeVisible();
      await snap(page, "barber added");

      // The customer can now choose them.
      let staffStep = await customerSees();
      await expect(staffStep.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
      await snap(visitor.page, "customer sees the new barber");

      // Edit: rename and take Sundays off.
      await page.getByRole("button", { name: `Edit ${name}` }).click();
      const edit = page.getByRole("dialog");
      await expect(edit.getByText("Edit staff member")).toBeVisible();
      await edit.locator("#staff-name").fill(renamed);
      await edit.getByRole("button", { name: "Sun", exact: true }).click();
      await edit.getByRole("button", { name: "Save changes" }).click();
      await expect(toast(page).filter({ hasText: "Staff member updated." })).toBeVisible();
      const card = page.locator("div.rounded-xl").filter({ has: page.getByText(renamed, { exact: true }) });
      await expect(card).toBeVisible();
      await expect(card.getByText("Sun", { exact: true })).toHaveCount(0);
      await expect(card.getByText("Mon", { exact: true })).toBeVisible();
      await snap(page, "barber edited");

      // Deactivate.
      await card.getByRole("switch", { name: `Deactivate ${renamed}` }).click();
      await expect(card.getByText("Deactivated").first()).toBeVisible();
      await snap(page, "barber deactivated");

      // Gone from the customer's choice list; the others remain.
      staffStep = await customerSees();
      await expect(staffStep.getByRole("button", { name: /^Nong/ })).toBeVisible();
      await expect(staffStep.getByRole("button", { name: new RegExp(`^${name}`) })).toHaveCount(0);
      await snap(visitor.page, "customer no longer sees the deactivated barber");
    } finally {
      await visitor.context.close();
    }
  });

  test("Services: add, change the price and delete, with the shop page following", async ({ page, browser, baseURL, snap }) => {
    const name = `E2E Beard Trim ${stamp()}`;
    const visitor = await newVisitor(browser, baseURL!);
    const shopRow = (price: string) => visitor.page.getByRole("button", { name: new RegExp(`^${name}.*${price}`) });

    try {
      await open(page, "/dashboard/services");
      await expectHealthy(page);
      for (const s of ["Men's cut", "Skin fade", "Hot-towel shave", "Cut & beard"]) {
        await expect(page.getByText(s, { exact: true }).first()).toBeVisible();
      }
      await snap(page, "services list");

      await page.getByRole("button", { name: "Add a service" }).click();
      const sheet = page.getByRole("dialog");
      await sheet.locator("#service-name").fill(name);
      await sheet.locator("#durationMin").fill("20");
      await sheet.locator("#price").fill("200");
      await sheet.locator("#service-description").fill("Added by the end-to-end suite.");
      await snap(page, "new service sheet");
      await sheet.getByRole("button", { name: "Add service" }).click();
      await expect(toast(page).filter({ hasText: "Service added." })).toBeVisible();
      await expect(page.getByText(name, { exact: true })).toBeVisible();
      await snap(page, "service added");

      await open(visitor.page, `/b/${SHOP}`);
      await expect(shopRow("200")).toBeVisible();
      await snap(visitor.page, "customer sees the new service");

      await page.getByRole("button", { name: `Edit ${name}` }).click();
      const edit = page.getByRole("dialog");
      await edit.locator("#price").fill("250");
      await edit.getByRole("button", { name: "Save changes" }).click();
      await expect(toast(page).filter({ hasText: "Service updated." })).toBeVisible();
      await open(visitor.page, `/b/${SHOP}`);
      await expect(shopRow("250")).toBeVisible();

      await page.getByRole("button", { name: `Edit ${name}` }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
      await expect(toast(page).filter({ hasText: "Service deleted." })).toBeVisible();
      await expect(page.getByText(name, { exact: true })).toHaveCount(0);
      await open(visitor.page, `/b/${SHOP}`);
      await expect(visitor.page.getByText(name)).toHaveCount(0);
      await snap(page, "service deleted");
    } finally {
      await visitor.context.close();
    }
  });

  test("Hours: a change is saved and survives a reload", async ({ page, snap }) => {
    const closeInput = (p: Page) =>
      p
        .getByRole("switch", { name: "Tuesday open" })
        .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
        .getByLabel("Closes");

    await open(page, "/dashboard/hours");
    await expectHealthy(page);
    await expect(page.getByText("Monday").first()).toBeVisible();
    await expect(page.getByText("Closed", { exact: true }).first()).toBeVisible(); // Monday
    await expect(page.getByText("Public holiday")).toBeVisible(); // seeded one-off day
    const original = await closeInput(page).inputValue();
    expect(original).toBe("20:00");
    await snap(page, "opening hours");

    try {
      await closeInput(page).fill("19:00");
      await page.getByRole("button", { name: "Save opening hours" }).click();
      await expect(toast(page).first()).toBeVisible();
      await snap(page, "hours saved");
      await open(page, "/dashboard/hours");
      await expect(closeInput(page)).toHaveValue("19:00");
    } finally {
      await closeInput(page).fill(original);
      await page.getByRole("button", { name: "Save opening hours" }).click();
      await expect(toast(page).first()).toBeVisible();
    }
    await open(page, "/dashboard/hours");
    await expect(closeInput(page)).toHaveValue(original);
  });

  test("Settings: a cancellation-policy edit appears on the shop page", async ({ page, browser, baseURL, snap }) => {
    const visitor = await newVisitor(browser, baseURL!);
    const policy = `E2E policy ${stamp()}: free up to 24 hours before, no charge.`;

    await open(page, "/dashboard/settings");
    await expectHealthy(page);
    const box = page.locator("#cancellationPolicy");
    await expect(page.getByText("Live — customers can find and book you.")).toBeVisible();
    const original = await box.inputValue();
    expect(original).toContain("Free up to 2 hours");
    await snap(page, "settings");

    try {
      await box.fill(policy);
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(toast(page).filter({ hasText: /Saved|saved|updated/ })).toBeVisible();
      await snap(page, "settings saved");

      await open(visitor.page, `/b/${SHOP}`);
      await expect(visitor.page.getByText(policy).first()).toBeVisible();
      await snap(visitor.page, "new policy on the shop page");
    } finally {
      await open(page, "/dashboard/settings");
      await page.locator("#cancellationPolicy").fill(original);
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(toast(page).first()).toBeVisible();
      await visitor.context.close();
    }
  });
});
