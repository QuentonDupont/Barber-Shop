import { test, expect, open, signInAs, newVisitor, toast, expectHealthy, expectNothingAboveSheet, bangkokToday, SHOP, STAFF_PLOY } from "./fixtures";
import { chooseBarber, openShop, pickNextOpenDay, reviewFirstSlot } from "./booking";
import type { Page } from "@playwright/test";

/** Shop owner flow: Today, Calendar, Staff, Services, Hours, Settings. English labels. */

const stamp = () => String(Date.now()).slice(-7);

/** Add a day to a yyyy-MM-dd key (calendar arithmetic, no time zone involved). */
function plusDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Open the owner's "add booking" sheet and choose service and barber. Then walk
 * forward from today until a day has free times (today's own depend on the hour
 * the suite runs), and return that date. Today is always tried first.
 */
async function openAddBooking(page: Page, opts: { service: string; barber: string }) {
  await page.getByTestId("add-booking-button").click();
  const sheet = page.getByTestId("add-booking-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Add a booking for a customer")).toBeVisible();

  const serviceSelect = sheet.getByTestId("add-booking-service");
  await serviceSelect.selectOption(await serviceSelect.locator("option", { hasText: opts.service }).first().getAttribute("value") as string);
  const staffSelect = sheet.getByTestId("add-booking-staff");
  await staffSelect.selectOption(await staffSelect.locator("option", { hasText: opts.barber }).first().getAttribute("value") as string);

  const today = bangkokToday();
  for (let i = 0; i < 10; i += 1) {
    const date = plusDays(today, i);
    await sheet.getByTestId("add-booking-date").fill(date);
    const outcome = sheet.getByTestId("add-booking-slot").first().or(sheet.getByTestId("add-booking-no-times"));
    await expect(outcome).toBeVisible();
    if ((await sheet.getByTestId("add-booking-slot").count()) > 0) return { sheet, date };
  }
  throw new Error("No day with free times in the next ten days");
}

async function fillCustomer(sheet: ReturnType<Page["getByTestId"]>, name: string, phone: string) {
  await sheet.getByTestId("add-booking-name").fill(name);
  await sheet.getByTestId("add-booking-phone").fill(phone);
}

/** Cancel a booking from its row on the page that is showing it. */
async function cancelRow(page: Page, customerName: string) {
  await page.getByText(customerName).filter({ visible: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancel this booking" }).click();
  await expect(toast(page).filter({ hasText: "Booking cancelled." })).toBeVisible();
}

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


  test("Add booking: a phone or walk-in customer with no account appears on Today", async ({ page, snap }) => {
    const customer = `E2E Phone ${stamp()}`;
    await open(page, "/dashboard");
    await expectHealthy(page);
    await snap(page, "today, before adding");

    const { sheet, date } = await openAddBooking(page, { service: "Men's cut", barber: "Nong" });
    await expectNothingAboveSheet(page);
    await snap(page, "add booking sheet");
    const slot = sheet.getByTestId("add-booking-slot").first();
    const startsAt = (await slot.getAttribute("data-starts-at")) as string;
    await slot.click();
    await fillCustomer(sheet, customer, "0812345678");
    await snap(page, "add booking filled in");
    await sheet.getByTestId("add-booking-submit").click();
    await expect(toast(page).filter({ hasText: "Booking added." })).toBeVisible();
    await expect(page.getByTestId("add-booking-sheet")).toHaveCount(0);

    // It shows on Today (when the first free day is today) or on the calendar for that day.
    if (date === bangkokToday()) {
      await expect(page.getByText(customer).filter({ visible: true }).first()).toBeVisible();
      await snap(page, "today shows the new booking");
    } else {
      await open(page, `/dashboard/calendar?date=${date}`);
      await expect(page.getByText(customer).filter({ visible: true }).first()).toBeVisible();
      await snap(page, `calendar shows the new booking on ${date}`);
    }

    // It is recorded as shop-entered, with the phone number the owner typed.
    await page.getByText(customer).filter({ visible: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Booked by")).toBeVisible();
    await expect(dialog.getByText("Shop entered")).toBeVisible();
    await expect(dialog.getByText("0812345678").first()).toBeVisible();
    await snap(page, "the booking sheet says shop entered");
    expect(startsAt).toBeTruthy();

    // Tidy up so the shop is as we found it.
    await dialog.getByRole("button", { name: "Cancel this booking" }).click();
    await expect(toast(page).filter({ hasText: "Booking cancelled." })).toBeVisible();
  });

  test("Add booking: a time that is taken cannot be booked again", async ({ page, browser, baseURL, snap }) => {
    const first = `E2E First ${stamp()}`;
    const second = `E2E Second ${stamp()}`;
    const other = await newVisitor(browser, baseURL!, "en", "owner");
    try {
      await open(page, "/dashboard");
      await open(other.page, "/dashboard");

      // A second owner screen opens the sheet and sees the time as free.
      const { sheet: staleSheet, date } = await openAddBooking(other.page, { service: "Men's cut", barber: "Nong" });
      const target = staleSheet.getByTestId("add-booking-slot").first();
      const startsAt = (await target.getAttribute("data-starts-at")) as string;
      await target.click();
      await fillCustomer(staleSheet, second, "0899999999");

      // The first screen books that same time for Nong.
      const { sheet } = await openAddBooking(page, { service: "Men's cut", barber: "Nong" });
      await page.getByTestId("add-booking-date").fill(date);
      const slot = sheet.locator(`[data-testid="add-booking-slot"][data-starts-at="${startsAt}"]`);
      await expect(slot).toBeVisible();
      await slot.click();
      await fillCustomer(sheet, first, "0811111111");
      await sheet.getByTestId("add-booking-submit").click();
      await expect(toast(page).filter({ hasText: "Booking added." })).toBeVisible();

      // Opening the sheet again: that time is gone for Nong (and nothing overlapping it is offered).
      const again = await openAddBooking(page, { service: "Men's cut", barber: "Nong" }).catch(() => null);
      if (again) {
        await again.sheet.getByTestId("add-booking-date").fill(date);
        await expect(again.sheet.getByTestId("add-booking-slots").or(again.sheet.getByTestId("add-booking-no-times"))).toBeVisible();
        await expect(again.sheet.locator(`[data-testid="add-booking-slot"][data-starts-at="${startsAt}"]`)).toHaveCount(0);
        await snap(page, "the taken time is no longer offered");
      }

      // The stale screen still shows it and tries anyway: the server refuses.
      await staleSheet.getByTestId("add-booking-submit").click();
      await expect(toast(other.page).filter({ hasText: "That time is no longer free" })).toBeVisible();
      await snap(other.page, "the clash is refused");

      // Exactly one booking exists in that slot.
      await open(page, `/dashboard/calendar?date=${date}`);
      await expect(page.getByText(first).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(second)).toHaveCount(0);

      await cancelRow(page, first);
    } finally {
      await other.context.close();
    }
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
