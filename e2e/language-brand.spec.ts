import { test, expect, open, signInAs, toast, SHOP } from "./fixtures";
import type { Page } from "@playwright/test";

/** Language toggle, brand logo, and "no untranslated English on Thai pages". */

test.describe("language toggle", () => {
  // QA 11 BUG 2: the switch used to sit on top of the landing page's "Sign in".
  // Every header that has a button or link on its right must stay clear of it.
  for (const row of [
    { name: "landing page", path: "/", as: undefined },
    { name: "public shop page", path: `/b/${SHOP}`, as: undefined },
    { name: "customer app", path: "/app", as: "customer" as const },
    { name: "owner dashboard", path: "/dashboard", as: "owner" as const },
  ]) {
    test(`the language switch never covers a header button (${row.name})`, async ({ page, context, baseURL, snap }) => {
      if (row.as) await signInAs(context, row.as, baseURL!);
      await open(page, row.path);
      const switchBox = await page.locator('[data-testid="locale-bar"] [role="group"]').boundingBox();
      expect(switchBox, "language switch is on screen").not.toBeNull();
      const targets = page.locator("header a, header button");
      const count = await targets.count();
      expect(count, "the header has something to tap").toBeGreaterThan(0);
      for (let i = 0; i < count; i += 1) {
        const target = targets.nth(i);
        if (!(await target.isVisible())) continue;
        const box = (await target.boundingBox())!;
        const overlap =
          box.x < switchBox!.x + switchBox!.width &&
          box.x + box.width > switchBox!.x &&
          box.y < switchBox!.y + switchBox!.height &&
          box.y + box.height > switchBox!.y;
        expect.soft(overlap, `header control "${(await target.innerText()).trim()}" overlaps the language switch`).toBe(false);
        // Tappable: the topmost thing at its centre is the control itself.
        const tappable = await target.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!hit && el.contains(hit);
        });
        expect.soft(tappable, `header control "${(await target.innerText()).trim()}" can be tapped`).toBe(true);
      }
      await snap(page, `${row.name} header`);
    });
  }

  test("the TH/EN choice persists across reloads and pages", async ({ page, context, baseURL, snap }) => {
    await context.addCookies([{ name: "tatnat-locale", value: "th", url: baseURL! }]); // Thai is the default
    await open(page, "/sign-in");
    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(page.getByRole("heading", { name: "ยินดีต้อนรับกลับมา" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ไทย" })).toHaveAttribute("aria-pressed", "true");
    await snap(page, "Thai");

    await page.getByRole("button", { name: "EN" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
    await snap(page, "switched to English");

    // Survives a reload, and a different page.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await open(page, "/privacy");
    await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
    expect((await context.cookies()).find((c) => c.name === "tatnat-locale")?.value).toBe("en");

    // And back to Thai, also persisted.
    await page.getByRole("button", { name: "ไทย" }).click();
    await expect(page.getByRole("heading", { name: "นโยบายความเป็นส่วนตัว" })).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await open(page, "/sign-in");
    await expect(page.getByRole("heading", { name: "ยินดีต้อนรับกลับมา" })).toBeVisible();
    await snap(page, "back to Thai after reload");
  });
});

test.describe("brand logo", () => {
  async function logoState(page: Page, base = "wordmark") {
    return page.evaluate((base) => {
      const info = (sel: string) => {
        const el = document.querySelector<HTMLImageElement>(sel);
        if (!el) return { exists: false, shown: false, loaded: false };
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          exists: true,
          shown: r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden",
          loaded: el.complete && el.naturalWidth > 0,
        };
      };
      return {
        dark: document.documentElement.classList.contains("dark"),
        light: info(`img[src$="/brand/${base}.svg"]`),
        darkLogo: info(`img[src$="/brand/${base}-dark.svg"]`),
      };
    }, base);
  }

  test("the TatNat logo is visible in light mode", async ({ page, snap }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await open(page, "/");
    const s = await logoState(page);
    expect(s.dark).toBe(false);
    expect(s.light).toEqual({ exists: true, shown: true, loaded: true });
    expect(s.darkLogo.shown).toBe(false);
    await expect(page.getByRole("img", { name: "TatNat — ตัดนัด" }).first()).toBeVisible();
    await snap(page, "logo, light");
  });

  test("the TatNat logo is visible in dark mode", async ({ page, snap }) => {
    await page.addInitScript(() => localStorage.setItem("tatnat-theme", "dark"));
    await open(page, "/");
    const s = await logoState(page);
    expect(s.dark).toBe(true);
    expect(s.darkLogo).toEqual({ exists: true, shown: true, loaded: true });
    expect(s.light.shown).toBe(false);
    await snap(page, "logo, dark");
  });

  test("the logo also shows on the sign-in screen in both themes", async ({ page, snap }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.addInitScript((t) => localStorage.setItem("tatnat-theme", t), theme);
      await open(page, "/sign-in");
      const s = await logoState(page, "icon-mark"); // the auth screens use the icon mark
      expect(s.dark).toBe(theme === "dark");
      const shown = theme === "dark" ? s.darkLogo : s.light;
      expect(shown, `${theme} logo on /sign-in`).toEqual({ exists: true, shown: true, loaded: true });
      await snap(page, `sign-in logo, ${theme}`);
    }
  });
});

/**
 * Thai is the default language, so Thai pages must not leak English. Each row is
 * a page plus a few key English phrases that must NOT appear on it (taken from
 * the English screens), and a Thai phrase that must. Soft assertions so one run
 * lists every leak on a page.
 */
const THAI_PAGES: Array<{
  name: string;
  path: string;
  as?: "customer" | "owner";
  thai?: string;
  english: string[];
}> = [
  { name: "landing page", path: "/", english: ["Sign in", "Book your next appointment", "Create an account", "I already have one", "Request beta invite", "Real availability"] },
  { name: "sign-in", path: "/sign-in", thai: "ยินดีต้อนรับกลับมา", english: ["Welcome back", "Demo mode", "Continue with Google", "Show password"] },
  { name: "sign-up", path: "/sign-up", thai: "สร้างบัญชีของคุณ", english: ["Create your account", "Full name", "Mobile number", "Create account"] },
  { name: "discover", path: "/app", as: "customer", english: ["Find a place near you", "Sort by what's nearest", "Search shops", "Explore", "What's on"] },
  { name: "shop page", path: "/b/nong-barber", thai: "เลือกบริการ", english: ["Choose a service", "Choose your barber", "Pick a day", "Pick a time", "Cancellation / no-show policy", "Instant confirmation", "All places"] },
  { name: "my bookings", path: "/app/bookings", as: "customer", thai: "การจองของฉัน", english: ["My bookings", "Upcoming", "Confirmed", "Pending"] },
  { name: "account", path: "/app/account", as: "customer", thai: "ข้อมูลของคุณ", english: ["Your details", "Run a business?", "Sign out", "Save changes", "Your data"] },
  { name: "privacy policy", path: "/privacy", thai: "นโยบายความเป็นส่วนตัว", english: ["Privacy policy", "What we collect", "Your rights"] },
  { name: "owner today", path: "/dashboard", as: "owner", english: ["Today’s schedule", "Coming up", "Confirmed", "Pending", "To confirm"] },
  { name: "owner staff", path: "/dashboard/staff", as: "owner", thai: "พนักงาน", english: ["Add staff member", "Active", "Works"] },
  { name: "owner services", path: "/dashboard/services", as: "owner", thai: "บริการ", english: ["Add a service", "Visible", "Edit", "Preview your page"] },
  { name: "owner hours", path: "/dashboard/hours", as: "owner", thai: "เวลาเปิด-ปิด", english: ["Opening hours", "Save opening hours", "Holidays and one-off days"] },
  { name: "owner settings", path: "/dashboard/settings", as: "owner", thai: "ตั้งค่า", english: ["Accept bookings", "Business details", "Save settings", "Booking rules"] },
];

test.describe("Thai pages carry no untranslated English", () => {
  test.use({ lang: "th" });

  for (const row of THAI_PAGES) {
    test(row.name, async ({ page, context, baseURL, snap }) => {
      if (row.as) await signInAs(context, row.as, baseURL!);
      await open(page, row.path);
      await expect(page.locator("html")).toHaveAttribute("lang", "th");
      const body = page.locator("body");
      if (row.thai) await expect(body).toContainText(row.thai);
      // Read the visible text once, then check every phrase against it.
      const text = await body.innerText();
      for (const phrase of row.english) {
        expect.soft(text, `English text "${phrase}" on the Thai ${row.name}`).not.toContain(phrase);
      }
      await snap(page, `${row.name} in Thai`);
    });
  }

  test("the booking detail sheet is in Thai", async ({ page, context, baseURL, snap }) => {
    await signInAs(context, "customer", baseURL!);
    await open(page, "/app/bookings");
    await page.locator("main button").filter({ hasText: "THB" }).first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    // Labels only: the shop's own name ("Nong Barber") is data and legitimately contains "Barber".
    const text = [await sheet.locator("dt").allInnerTexts(), await sheet.getByRole("button").allInnerTexts(), await sheet.getByRole("link").allInnerTexts()].flat().join("\n");
    for (const phrase of ["Service", "Time zone", "Book again", "Cancel this booking", "Barber"]) {
      expect.soft(text, `English text "${phrase}" in the Thai booking detail sheet`).not.toContain(phrase);
    }
    await snap(page, "booking detail sheet in Thai");
  });

  test("owner confirmation messages are in Thai too", async ({ page, context, baseURL, snap }) => {
    await signInAs(context, "owner", baseURL!);
    await open(page, "/dashboard/staff");
    await page.getByRole("button", { name: "เพิ่มพนักงาน" }).click();
    const name = `E2E ไทย ${Date.now().toString().slice(-6)}`;
    await page.getByRole("dialog").locator("#staff-name").fill(name);
    await page.getByRole("dialog").getByRole("button", { name: "เพิ่มพนักงาน" }).click();
    const message = toast(page).first();
    await expect(message).toBeVisible();
    const shown = await message.innerText();
    await snap(page, "staff added, message language");
    // Tidy up: deactivate so the new barber is hidden from customers.
    await page.getByRole("switch", { name: `ปิดใช้งาน ${name}` }).click();
    expect.soft(shown, "owner success message should be Thai").not.toContain("Staff member added.");
  });
});
