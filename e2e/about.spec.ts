import { test, expect, open, expectHealthy } from "./fixtures";
import type { Page } from "@playwright/test";

/** Public About page (tatnat-accounts-billing stage 1; handoffs/06-about.md). */

const THAI = /[฀-๿]/;

/** English phrases from the page that must never show on the Thai page. */
const ENGLISH_PHRASES = [
  "Book easy",
  "Book in 3 steps",
  "Always free for customers",
  "Pick a shop",
  "Pick your barber",
  "Confirm and show up",
  "Let a calendar",
  "What your shop gets",
  "Free and paid",
  "Start free",
  "Paid plans are not on sale",
  "Priority support",
  "Cancellation policy",
  "Questions people ask",
  "Does TatNat take",
  "Ready to stop booking by chat",
  "Open your shop",
  "Find a shop and book",
  "Read the privacy policy",
  "Not included",
  "Included",
  "Unlimited",
];

async function overlapsAmongSiblings(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    const hit = (a: DOMRect, b: DOMRect) =>
      a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    for (const list of Array.from(document.querySelectorAll("main ul, main ol, main .flex"))) {
      const kids = Array.from(list.children).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      for (let i = 0; i < kids.length; i += 1) {
        for (let j = i + 1; j < kids.length; j += 1) {
          if (hit(kids[i]!.getBoundingClientRect(), kids[j]!.getBoundingClientRect())) {
            problems.push(`${(kids[i]!.textContent ?? "").trim().slice(0, 24)} overlaps ${(kids[j]!.textContent ?? "").trim().slice(0, 24)}`);
          }
        }
      }
    }
    return problems;
  });
}

for (const lang of ["th", "en"] as const) {
  test.describe(`About page in ${lang === "th" ? "Thai" : "English"}`, () => {
    test.use({ lang });

    test("renders with its four parts, no login", async ({ page, snap }) => {
      const response = await page.goto("/about");
      expect(response?.status()).toBe(200);
      await page.waitForLoadState("networkidle");
      await expectHealthy(page);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page).toHaveURL(/\/about$/);

      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toHaveText(lang === "th" ? "จองคิวง่าย ร้านได้เต็ม ไม่มีค่าคอม" : "Book easy. Fill your chairs. No commission.");
      for (const id of ["customers-title", "owners-title", "plans-title", "faq-title"]) {
        await expect(page.locator(`#${id}`), `section heading #${id}`).toBeVisible();
      }
      await expect(page.locator("#customers-title")).toHaveText(lang === "th" ? "จองคิวใน 3 ขั้นตอน" : "Book in 3 steps");
      await expect(page.locator("#owners-title")).toHaveText(lang === "th" ? "ให้ปฏิทินทำงานแทนแชต" : "Let a calendar do the chat's job");

      // Price table: prices from decisions #24/#25 and the required notice.
      const table = page.getByRole("table");
      for (const price of ["฿0", "฿490", "฿990"]) await expect(table).toContainText(price);
      await expect(page.getByRole("note")).toContainText(
        lang === "th" ? "แผนเสียเงินยังไม่เปิดให้ซื้อ" : "Paid plans are not on sale yet",
      );
      await expect(page.getByRole("button", { name: lang === "th" ? "ดูแผนเสียเงิน" : "See paid plans" })).toBeDisabled();
      await expect(page.locator("main")).toContainText(lang === "th" ? "ไม่หักส่วนแบ่ง" : "never take a cut of your bookings");

      // Forbidden claims.
      const text = (await page.locator("body").textContent()) ?? "";
      for (const banned of [/free forever/i, /zero cost/i, /no commission ever/i, /\[TBD/i, /ฟรีตลอดไป/]) {
        expect(text, `banned wording ${banned}`).not.toMatch(banned);
      }

      // First FAQ open, others closed.
      const details = page.locator("#faq details");
      await expect(details).toHaveCount(9);
      await expect(details.first()).toHaveAttribute("open", "");
      await expect(details.nth(1)).not.toHaveAttribute("open", "");
      await details.nth(1).locator("summary").click();
      await expect(details.nth(1)).toHaveAttribute("open", "");

      // Structured data and a title in the page's own language.
      await expect(page).toHaveTitle(lang === "th" ? /เกี่ยวกับตัดนัด/ : /About TatNat/);
      expect(await page.locator('script[type="application/ld+json"]').count()).toBeGreaterThan(0);
      await snap(page, `about in ${lang}`);
    });

    test("nothing overlaps, nothing scrolls sideways, tap targets are 44px", async ({ page, snap }) => {
      await open(page, "/about");
      const widths = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        view: document.documentElement.clientWidth,
      }));
      expect(widths.doc, "page is wider than the screen").toBeLessThanOrEqual(widths.view + 1);
      expect(await overlapsAmongSiblings(page)).toEqual([]);

      const small = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll("main a, main button, main summary, header a, footer a"))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.height < 43.5) out.push(`${(el.textContent ?? "").trim().slice(0, 30)} is ${Math.round(r.height)}px tall`);
        }
        return out;
      });
      expect(small, "controls shorter than 44px").toEqual([]);

      // Every sentence is inside the screen horizontally (the table scrolls inside its own box).
      const clipped = await page.evaluate(() => {
        const view = document.documentElement.clientWidth;
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll("main h1, main h2, main h3, main p"))) {
          if (el.closest('[role="region"]')) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.right > view + 1 || r.left < -1) out.push((el.textContent ?? "").trim().slice(0, 30));
        }
        return out;
      });
      expect(clipped, "text pushed off screen").toEqual([]);
      await snap(page, `about layout in ${lang}`);
    });
  });
}

test.describe("About page in Thai mode has no untranslated English", () => {
  test.use({ lang: "th" });

  test("whole page", async ({ page, snap }) => {
    await open(page, "/about");
    // textContent, so answers inside closed FAQ items are checked too.
    const text = (await page.locator("main").textContent()) ?? "";
    expect(text).toMatch(THAI);
    for (const phrase of ENGLISH_PHRASES) {
      expect.soft(text, `English text "${phrase}" on the Thai About page`).not.toContain(phrase);
    }
    await snap(page, "About in Thai");
  });
});

test.describe("links to the About page", () => {
  for (const lang of ["th", "en"] as const) {
    test.describe(`in ${lang}`, () => {
      test.use({ lang });

      test("the landing page links to /about and the link works", async ({ page }) => {
        await open(page, "/");
        const link = page.locator('header a[href="/about"]');
        await expect(link).toBeVisible();
        await link.click();
        await expect(page).toHaveURL(/\/about$/);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      });

      test("the landing footer links to /about", async ({ page }) => {
        await open(page, "/");
        await expect(page.locator('footer a[href="/about"]')).toBeVisible();
      });

      test("the sign-up page links to /about and the link works", async ({ page }) => {
        await open(page, "/sign-up");
        const link = page.locator('main a[href="/about"]');
        await expect(link).toBeVisible();
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
        await link.click();
        await expect(page).toHaveURL(/\/about$/);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      });
    });
  }

  test("the About page's sign-in, privacy and customer links work", async ({ page }) => {
    await open(page, "/about");
    await expect(page.locator('header a[href="/sign-in"]')).toBeVisible();
    await expect(page.locator('a[href="/privacy"]').first()).toBeVisible();
    await expect(page.locator('a[href="/app"]').first()).toBeVisible();
  });
});
