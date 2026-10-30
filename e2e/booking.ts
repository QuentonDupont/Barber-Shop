import { expect, bangkokToday, expectNothingAboveSheet, open, SHOP } from "./fixtures";
import type { Page } from "@playwright/test";

/** Open the shop page for a given service (English labels). */
export async function openShop(page: Page, service?: string) {
  await open(page, `/b/${SHOP}`);
  if (service) {
    await page.getByRole("button", { name: new RegExp(`^${service}`) }).click();
    await expect(page.getByRole("button", { name: new RegExp(`^${service}`) })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
}

/** The "Pick a time" buttons. */
export function slotButtons(page: Page) {
  return page.locator('section[aria-labelledby="pick-time"] button[aria-pressed]');
}

export function calendarDay(page: Page, date: string) {
  return page.locator(`button[role="gridcell"][aria-label="${date}"]`);
}

/**
 * Click the first enabled calendar day strictly after today (today's own slots
 * depend on the time of day the suite happens to run). Returns that date.
 */
export async function pickNextOpenDay(page: Page, opts: { weekdayIn?: number[] } = {}): Promise<string> {
  const today = bangkokToday();
  for (let month = 0; month < 3; month += 1) {
    const labels = await page
      .locator('button[role="gridcell"]:not([disabled])')
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
    const target = labels.find((d) => {
      if (!(d > today)) return false;
      if (!opts.weekdayIn) return true;
      const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
      return opts.weekdayIn.includes(wd);
    });
    if (target) {
      await calendarDay(page, target).click();
      await expect(page).toHaveURL(new RegExp(`date=${target}`));
      await expect(slotButtons(page).first()).toBeVisible();
      return target;
    }
    await page.getByRole("button", { name: "Next month" }).click();
  }
  throw new Error("No open day found in the next three months");
}

/** Pick the first free time, press Review, and return the open confirm dialog. */
export async function reviewFirstSlot(page: Page) {
  const slot = slotButtons(page).first();
  await slot.click();
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Review/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Confirm your booking")).toBeVisible();
  // The sheet must cover the header, the logo and the language switch.
  await expectNothingAboveSheet(page);
  return dialog;
}

export async function chooseBarber(page: Page, name: string) {
  const section = page.locator('section[aria-labelledby="pick-staff"]');
  await section.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await expect(section.getByRole("button", { name: new RegExp(`^${name}`) })).toHaveAttribute("aria-pressed", "true");
}
