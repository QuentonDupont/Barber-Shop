import { test, expect, signInAs, open, expectHealthy, bangkokToday, toast, SHOP } from "./fixtures";
import { calendarDay, chooseBarber, openShop, pickNextOpenDay, reviewFirstSlot, slotButtons } from "./booking";

/**
 * Customer flow: landing -> discover/search -> shop page (with cancellation
 * policy) -> service -> barber (named and "any available") -> day and time ->
 * confirm -> success message -> My bookings. English labels throughout; Thai
 * has its own checks in language-brand.spec.ts.
 */

const POLICY = /Free up to 2 hours before your appointment; 50% charge inside that window, full charge for a no-show\./;
const SVC_CUT = "c0000000-0000-4000-8000-000000000001";

test.describe("customer flow", () => {
  test("landing, then discover and search, then the shop page with its cancellation policy", async ({ page, snap }) => {
    // Landing page, signed out.
    await open(page, "/");
    await expectHealthy(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("under a minute");
    await snap(page, "landing page");

    // Sign in with the one-tap demo customer.
    // On a phone the fixed language switch can sit on top of this link.
    const tapped = await page
      .getByRole("link", { name: "Sign in" })
      .click({ timeout: 5000 })
      .then(() => true, () => false);
    expect.soft(tapped, 'the landing page "Sign in" link can be tapped (not covered by the language switch)').toBe(true);
    if (!tapped) await open(page, "/sign-in");
    await expect(page).toHaveURL(/\/sign-in/);
    await page.waitForLoadState("networkidle");
    await snap(page, "sign in with demo buttons");
    await expect(async () => {
      await page.getByRole("button", { name: "Customer" }).click();
      await expect(page).toHaveURL(/\/app$/, { timeout: 4000 });
    }).toPass({ timeout: 20_000 });

    // Discover: both seeded shops, then search.
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("2 places")).toBeVisible();
    await expect(page.getByText("Nong Barber")).toBeVisible();
    await expect(page.getByText("Baan Suan Spa")).toBeVisible();
    await snap(page, "discover - all shops");

    const search = page.getByRole("searchbox", { name: "Search businesses" });
    await search.fill("zzz-nothing");
    await expect(page.getByText("Nothing matches that")).toBeVisible();
    await snap(page, "search with no match");

    await search.fill("barber");
    await expect(page.getByText("1 place", { exact: true })).toBeVisible();
    await expect(page.getByText("Baan Suan Spa")).toHaveCount(0);
    await snap(page, "search for barber");

    // Open the shop.
    await page.getByRole("link", { name: /Nong Barber/ }).click();
    await expect(page).toHaveURL(new RegExp(`/b/${SHOP}`));
    await page.waitForLoadState("networkidle");
    await expectHealthy(page);
    await expect(page.getByRole("heading", { level: 1, name: "Nong Barber" })).toBeVisible();
    // Cancellation policy is on the shop page.
    await expect(page.getByText("Cancellation / no-show policy").first()).toBeVisible();
    await expect(page.getByText(POLICY)).toBeVisible();
    // The booking steps are all there.
    for (const step of ["Choose a service", "Choose your barber", "Pick a day", "Pick a time"]) {
      await expect(page.getByRole("heading", { name: step })).toBeVisible();
    }
    await snap(page, "shop page with cancellation policy");
  });

  test("book with any available barber: the success message names the barber and My bookings shows it", async ({ page, context, baseURL, snap }) => {
    await signInAs(context, "customer", baseURL!);
    await openShop(page, "Men's cut");
    await snap(page, "service chosen");

    // Barber step: "Any available" plus both barbers.
    const staffSection = page.locator('section[aria-labelledby="pick-staff"]');
    await expect(staffSection.getByRole("button", { name: /^Any available/ })).toBeVisible();
    await expect(staffSection.getByRole("button", { name: /^Nong/ })).toBeVisible();
    await expect(staffSection.getByRole("button", { name: /^Ploy/ })).toBeVisible();
    await chooseBarber(page, "Any available");
    await snap(page, "any available barber chosen");

    const day = await pickNextOpenDay(page);
    await snap(page, `day ${day} chosen with times`);

    const dialog = await reviewFirstSlot(page);
    await expect(dialog.getByText("Barber", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Any available")).toBeVisible();
    await expect(dialog.getByText(POLICY)).toBeVisible(); // policy repeated on the confirm screen
    await snap(page, "confirm sheet");

    await dialog.getByRole("button", { name: "Confirm booking" }).click();

    // Success toast names whoever was assigned.
    const success = toast(page).filter({ hasText: /Booked with (Nong|Ploy)\./ });
    await expect(success).toBeVisible();
    const assigned = /Booked with (Nong|Ploy)\./.exec((await success.first().innerText()) ?? "")![1]!;
    await snap(page, `success message names ${assigned}`);

    // Lands on My bookings with the barber on the new booking.
    await expect(page).toHaveURL(/\/app\/bookings/);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
    const card = page.getByRole("button", { name: new RegExp(`Men's cut · .* · ${assigned}`) }).first();
    await expect(card).toBeVisible();
    await snap(page, "my bookings lists the new booking");

    await card.click();
    const detail = page.getByRole("dialog");
    await expect(detail.getByText("Barber", { exact: true })).toBeVisible();
    await expect(detail.getByText(assigned, { exact: true })).toBeVisible();
    await snap(page, "booking detail shows the barber");
  });

  test("book a named barber, see it in My bookings, then cancel it", async ({ page, context, baseURL, snap }) => {
    await signInAs(context, "customer", baseURL!);
    await openShop(page, "Men's cut");
    await chooseBarber(page, "Ploy");
    // Ploy works Monday to Friday only.
    const day = await pickNextOpenDay(page, { weekdayIn: [1, 2, 3, 4, 5] });
    await snap(page, `Ploy chosen, ${day}`);

    const dialog = await reviewFirstSlot(page);
    await expect(dialog.getByText("Ploy", { exact: true })).toBeVisible();
    await snap(page, "confirm sheet names Ploy");
    await dialog.getByRole("button", { name: "Confirm booking" }).click();

    // A named choice already knows who it asked for: the message is the plain one.
    await expect(toast(page).filter({ hasText: "Booked." })).toBeVisible();
    await expect(page).toHaveURL(/\/app\/bookings/);
    await page.waitForLoadState("networkidle");
    const card = page.getByRole("button", { name: /Men's cut · .* · Ploy/ }).first();
    await expect(card).toBeVisible();
    await snap(page, "my bookings shows Ploy");

    // Cancel it so the slot is free again.
    await card.click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel this booking" }).click();
    await expect(toast(page).filter({ hasText: "Booking cancelled." })).toBeVisible();
    await snap(page, "booking cancelled");
  });

  test("a named barber with no availability cannot be booked", async ({ page, context, baseURL, snap }) => {
    await signInAs(context, "customer", baseURL!);
    const today = bangkokToday();

    // The next Saturday that is not the demo shop's one-off holiday (today + 20).
    const holiday = new Date(`${today}T12:00:00Z`);
    holiday.setUTCDate(holiday.getUTCDate() + 20);
    const holidayKey = holiday.toISOString().slice(0, 10);
    const d = new Date(`${today}T12:00:00Z`);
    do d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() !== 6 || d.toISOString().slice(0, 10) === holidayKey);
    const saturday = d.toISOString().slice(0, 10);

    const showMonthOf = async (date: string) => {
      for (let i = 0; i < 3 && (await calendarDay(page, date).count()) === 0; i += 1) {
        await page.getByRole("button", { name: "Next month" }).click();
      }
      await expect(calendarDay(page, date)).toHaveCount(1);
    };

    await openShop(page, "Men's cut");

    // With "Any available", Nong makes Saturday bookable.
    await showMonthOf(saturday);
    await expect(calendarDay(page, saturday)).toBeEnabled();

    // Choosing Ploy closes the weekend on the calendar.
    await chooseBarber(page, "Ploy");
    await showMonthOf(saturday);
    await expect(calendarDay(page, saturday)).toBeDisabled();
    await snap(page, `Ploy chosen, Saturday ${saturday} is greyed out`);

    // Ploy only does cuts and fades: she is not offered for a shave at all.
    await page.getByRole("button", { name: /^Hot-towel shave/ }).click();
    const staffSection = page.locator('section[aria-labelledby="pick-staff"]');
    await expect(staffSection.getByRole("button", { name: /^Nong/ })).toBeVisible();
    await expect(staffSection.getByRole("button", { name: /^Ploy/ })).toHaveCount(0);
    await snap(page, "shave: Ploy is not offered");

    // And she drops off the list on a day she does not work.
    await open(page, `/b/${SHOP}?service=${SVC_CUT}&date=${saturday}`);
    await expect(staffSection.getByRole("button", { name: /^Nong/ })).toBeVisible();
    await expect(staffSection.getByRole("button", { name: /^Ploy/ })).toHaveCount(0);
    await snap(page, `${saturday}: only Nong is offered`);

    // Server-side guard: a forged request for Ploy on her day off is refused with
    // the "staff member isn't available" message, not silently handed to someone else.
    await openShop(page, "Men's cut");
    await chooseBarber(page, "Ploy");
    await pickNextOpenDay(page, { weekdayIn: [1, 2, 3, 4, 5] });
    const dialog = await reviewFirstSlot(page);
    await dialog.locator('input[name="startsAt"]').evaluate((el, value) => {
      (el as HTMLInputElement).value = value;
    }, `${saturday}T11:00:00+07:00`);
    await dialog.getByRole("button", { name: "Confirm booking" }).click();
    await expect(toast(page).filter({ hasText: "That staff member isn't available" })).toBeVisible();
    await expect(page).not.toHaveURL(/\/app\/bookings/);
    await snap(page, "server refuses Ploy on her day off");
  });

  test("a signed-out visitor is sent to sign in, and comes back to the same shop", async ({ page, snap }) => {
    await openShop(page, "Men's cut");
    await pickNextOpenDay(page);
    await slotButtons(page).first().click();
    await snap(page, "signed out: sign in to book");
    await page.getByRole("link", { name: /Sign in to book/ }).click();
    await expect(page).toHaveURL(/\/sign-in\?role=customer&next=/);
    expect(decodeURIComponent(page.url())).toContain(`next=/b/${SHOP}`);
  });
});
