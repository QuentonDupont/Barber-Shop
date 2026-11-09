import { test, expect, open, toast, expectHealthy } from "./fixtures";
import type { Locator, Page } from "@playwright/test";

/**
 * Customer account (tatnat-accounts-billing handoff 07, tests C1-C7): name and
 * phone, verified email change, photo, notification choices, the unchanged
 * "Your data" panel, and phone-size layout.
 *
 * Every test signs up its own brand-new customer, so nothing about the shared
 * demo customer is changed and there is nothing to put back.
 */

async function newCustomer(page: Page) {
  const email = `account-${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  await open(page, "/sign-up");
  await page.locator("#fullName").fill("Account Tester");
  await page.locator("#email").fill(email);
  await page.locator("#phone").fill("081 234 5678");
  await page.locator("#password").fill("longenough1");
  await page.locator("#consent").check();
  await page.getByRole("button", { name: /Create account|สร้างบัญชี/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.waitForLoadState("networkidle");
  return email;
}

// Real 8x8 pictures made with an image library when the spec was written.
const JPEG = Buffer.from(
  "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALAA4zf/2Q==",
  "base64",
);
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWM4UWGDFTEMLQkAQfNfAUoopdYAAAAASUVORK5CYII=",
  "base64",
);
const WEBP = Buffer.from(
  "UklGRjgAAABXRUJQVlA4ICwAAADQAQCdASoIAAgAAUAmJaACdLoB+AADsAD+yL//zYFc1z7/f/maMJSR4aAAAA==",
  "base64",
);

/** The same JPEG with a location/device (Exif) block spliced in after the start marker. */
function jpegWithExif(): Buffer {
  const payload = Buffer.from("Exif\0\0GPSLatitude=13.7563;Make=SecretPhone", "latin1");
  const segment = Buffer.concat([Buffer.from([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff]), payload]);
  return Buffer.concat([JPEG.subarray(0, 2), segment, JPEG.subarray(2)]);
}

const file = (name: string, mimeType: string, buffer: Buffer) => ({ name, mimeType, buffer });

async function save(page: Page) {
  await page.getByRole("button", { name: /Save changes|บันทึกการเปลี่ยนแปลง/ }).click();
}

test.describe("customer account - details (C1, C3)", () => {
  test("C1 name and phone persist after reload (English)", async ({ page, snap }) => {
    await newCustomer(page);
    await open(page, "/app/account");
    await expectHealthy(page);
    await snap(page, "account page");
    await page.locator("#fullName").fill("Ann Edited");
    await page.locator("#phone").fill("089 999 0000");
    await save(page);
    await expect(toast(page).filter({ hasText: "Profile updated." })).toBeVisible();
    await open(page, "/app/account");
    await expect(page.locator("#fullName")).toHaveValue("Ann Edited");
    await expect(page.locator("#phone")).toHaveValue("089 999 0000");
    await snap(page, "after reload");
  });

  test.describe("in Thai", () => {
    test.use({ lang: "th" });
    test("C1 name and phone persist after reload (Thai)", async ({ page, snap }) => {
      await newCustomer(page);
      await open(page, "/app/account");
      await expect(page.getByText("ข้อมูลของคุณ").first()).toBeVisible();
      await page.locator("#fullName").fill("สมชาย ทดสอบ");
      await page.locator("#phone").fill("082 111 3333");
      await save(page);
      await expect(toast(page).filter({ hasText: "อัปเดตโปรไฟล์แล้ว" })).toBeVisible();
      await open(page, "/app/account");
      await expect(page.locator("#fullName")).toHaveValue("สมชาย ทดสอบ");
      await expect(page.locator("#phone")).toHaveValue("082 111 3333");
      await snap(page, "Thai account after reload");
    });
  });

  test("C3 empty name or phone shows a friendly message", async ({ page, snap }) => {
    await newCustomer(page);
    await open(page, "/app/account");
    await page.locator("#fullName").fill("");
    await save(page);
    await expect(page.getByText("Please tell us your name")).toBeVisible();
    await page.locator("#fullName").fill("Ann Valid");
    await page.locator("#phone").fill("");
    await save(page);
    await expect(page.getByText("Enter a number a shop can reach you on")).toBeVisible();
    await snap(page, "friendly errors");
    await expect(page.getByText("Please tell us your name")).toHaveCount(0);
  });
});

test.describe("customer account - email (C2, C3)", () => {
  test("C2 the old email stays until the new one is confirmed", async ({ page, snap }) => {
    const oldEmail = await newCustomer(page);
    const newEmail = `changed-${Date.now()}@example.com`;
    await open(page, "/app/account");
    await expect(page.getByTestId("current-email")).toHaveText(oldEmail);

    await page.locator("#newEmail").fill(newEmail);
    await page.getByRole("button", { name: "Send confirm link" }).click();
    await expect(page.getByTestId("pending-email")).toBeVisible();
    await expect(page.getByTestId("pending-email-address")).toHaveText(newEmail);
    await expect(page.getByTestId("current-email")).toHaveText(oldEmail);
    await snap(page, "pending verification");

    // Still pending after a reload, and the old address is still the current one.
    await open(page, "/app/account");
    await expect(page.getByTestId("pending-email-address")).toHaveText(newEmail);
    await expect(page.getByTestId("current-email")).toHaveText(oldEmail);
    await expect(page.getByRole("button", { name: "Demo: confirm" })).toBeVisible();

    await page.getByRole("button", { name: "Demo: confirm" }).click();
    await expect(page.getByTestId("current-email")).toHaveText(newEmail);
    await expect(page.getByTestId("pending-email")).toHaveCount(0);
    await snap(page, "confirmed");
    await open(page, "/app/account");
    await expect(page.getByTestId("current-email")).toHaveText(newEmail);
  });

  test("C2 a pending change can be cancelled", async ({ page }) => {
    const oldEmail = await newCustomer(page);
    await open(page, "/app/account");
    await page.locator("#newEmail").fill(`cancelled-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Send confirm link" }).click();
    await expect(page.getByTestId("pending-email")).toBeVisible();
    await page.getByRole("button", { name: "Cancel email change" }).click();
    await expect(page.getByTestId("pending-email")).toHaveCount(0);
    await expect(page.getByTestId("current-email")).toHaveText(oldEmail);
  });

  test("C3 invalid, same and empty email are refused with a friendly message", async ({ page, snap }) => {
    const oldEmail = await newCustomer(page);
    await open(page, "/app/account");
    const send = page.getByRole("button", { name: "Send confirm link" });

    await send.click();
    await expect(page.getByText("Please enter your new email.")).toBeVisible();

    await page.locator("#newEmail").fill("not-an-email");
    await send.click();
    await expect(page.getByText("That email does not look right. Check the spelling and try again.")).toBeVisible();

    await page.locator("#newEmail").fill(oldEmail.toUpperCase());
    await send.click();
    await expect(page.getByText("That is the email you already use.")).toBeVisible();
    await snap(page, "same email refused");

    await expect(page.getByTestId("pending-email")).toHaveCount(0);
    await expect(page.getByTestId("current-email")).toHaveText(oldEmail);
  });

  test.describe("in Thai", () => {
    test.use({ lang: "th" });
    test("C3 the email messages are in Thai", async ({ page, snap }) => {
      await newCustomer(page);
      await open(page, "/app/account");
      await page.locator("#newEmail").fill("ไม่ใช่อีเมล");
      await page.getByRole("button", { name: "ส่งลิงก์ยืนยัน" }).click();
      await expect(page.getByText("อีเมลนี้ดูไม่ถูกต้อง ลองตรวจตัวสะกดอีกครั้ง")).toBeVisible();
      await snap(page, "Thai email error");
    });
  });
});

test.describe("customer account - photo (C4)", () => {
  test("C4 jpg, png and webp are accepted, shown, and can be removed", async ({ page, snap }) => {
    await newCustomer(page);
    await open(page, "/app/account");
    await expect(page.getByTestId("photo-img")).toHaveCount(0);
    await snap(page, "no photo yet");

    for (const [name, type, buffer] of [
      ["me.jpg", "image/jpeg", JPEG],
      ["me.png", "image/png", PNG],
      ["me.webp", "image/webp", WEBP],
    ] as const) {
      await page.getByTestId("photo-input").setInputFiles(file(name, type, buffer));
      await expect(toast(page).filter({ hasText: "Photo saved." }).first()).toBeVisible();
      const img = page.getByTestId("photo-img");
      await expect(img).toBeVisible();
      await expect(img).toHaveAttribute("src", new RegExp(`^data:${type}`));
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    }
    await snap(page, "photo shown");

    // Survives a reload, then remove it.
    await open(page, "/app/account");
    await expect(page.getByTestId("photo-img")).toBeVisible();
    await page.getByRole("button", { name: "Remove photo" }).click();
    await expect(page.getByTestId("photo-img")).toHaveCount(0);
    await open(page, "/app/account");
    await expect(page.getByTestId("photo-img")).toHaveCount(0);
  });

  test("C4 other types, fake images and files over 2 MB are refused with a message", async ({ page, snap }) => {
    await newCustomer(page);
    await open(page, "/app/account");
    const input = page.getByTestId("photo-input");
    const alert = page.getByTestId("photo-card").getByRole("alert");

    await input.setInputFiles(file("doc.pdf", "application/pdf", Buffer.from("%PDF-1.7 hello")));
    await expect(alert).toHaveText(/Only JPG, PNG or WebP pictures are accepted\./);

    // Wrong size, right type.
    await input.setInputFiles(file("big.png", "image/png", Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)])));
    await expect(alert).toHaveText(/over 2 MB/);

    // A script wearing a .png name: the browser says image/png, the server reads the bytes and refuses.
    await input.setInputFiles(file("evil.png", "image/png", Buffer.from("<svg onload=alert(1)></svg>")));
    await expect(alert).toHaveText(/Only JPG, PNG or WebP pictures are accepted\./);
    await snap(page, "fake image refused");
    await expect(page.getByTestId("photo-img")).toHaveCount(0);
  });

  test("C4 location and device data is stripped from the stored picture", async ({ page }) => {
    await newCustomer(page);
    await open(page, "/app/account");
    const withExif = jpegWithExif();
    expect(withExif.includes("GPSLatitude")).toBe(true);
    await page.getByTestId("photo-input").setInputFiles(file("gps.jpg", "image/jpeg", withExif));
    await expect(page.getByTestId("photo-img")).toBeVisible();
    const src = (await page.getByTestId("photo-img").getAttribute("src"))!;
    const stored = Buffer.from(src.split(",")[1]!, "base64");
    expect(stored.includes("GPSLatitude")).toBe(false);
    expect(stored.includes("SecretPhone")).toBe(false);
    expect(stored.includes("Exif")).toBe(false);
    expect(stored.length).toBeLessThan(withExif.length);
  });
});

test.describe("customer account - notifications (C5)", () => {
  test("C5 defaults, separate marketing switch, persistence and consent time", async ({ page, snap }) => {
    await newCustomer(page);
    await open(page, "/app/account");
    const confirmations = page.locator("#pref-confirmations");
    const reminders = page.locator("#pref-reminders");
    const marketing = page.locator("#pref-marketing");

    await expect(confirmations).toHaveAttribute("aria-checked", "true");
    await expect(reminders).toHaveAttribute("aria-checked", "true");
    await expect(marketing).toHaveAttribute("aria-checked", "false");
    // Marketing has its own card, its own consent note and its own save button.
    const marketingCard = page.getByTestId("marketing-card");
    await expect(marketingCard.locator("#pref-marketing")).toHaveCount(1);
    await expect(marketingCard).toContainText("we record the date and time you agreed");
    await expect(page.getByTestId("service-prefs-card").locator("#pref-marketing")).toHaveCount(0);
    await expect(page.getByTestId("marketing-since")).toHaveCount(0);
    await snap(page, "defaults");

    // Turning reminders off and saving the service card must not switch marketing on.
    await reminders.click();
    await page.getByRole("button", { name: "Save notifications" }).click();
    await expect(toast(page).filter({ hasText: "Notifications saved." })).toBeVisible();
    await open(page, "/app/account");
    await expect(reminders).toHaveAttribute("aria-checked", "false");
    await expect(confirmations).toHaveAttribute("aria-checked", "true");
    await expect(marketing).toHaveAttribute("aria-checked", "false");

    // Marketing: on, saved separately, consent time shown and kept after reload.
    await marketing.click();
    await page.getByRole("button", { name: "Save news choice" }).click();
    await expect(toast(page).filter({ hasText: "News and offers are on." })).toBeVisible();
    await open(page, "/app/account");
    await expect(marketing).toHaveAttribute("aria-checked", "true");
    await expect(reminders).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("marketing-since")).toContainText("You agreed on");
    await snap(page, "marketing on with consent time");

    // Withdraw in one tap and save.
    await marketing.click();
    await page.getByRole("button", { name: "Save news choice" }).click();
    await expect(toast(page).filter({ hasText: "News and offers are off." })).toBeVisible();
    await open(page, "/app/account");
    await expect(marketing).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("marketing-since")).toContainText("Turned off on");
  });
});

test.describe("customer account - privacy panel (C6)", () => {
  test("C6 'Your data' is still there with its three actions", async ({ page, snap }) => {
    await newCustomer(page);
    await open(page, "/app/account");
    await expect(page.getByText("Your data", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Withdraw consent" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Download my data/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Request deletion/ })).toBeVisible();
    await snap(page, "your data panel");
  });
});

test.describe("customer account - layout (C7)", () => {
  test.use({ lang: "th", viewport: { width: 360, height: 740 } });

  test("C7 Thai first, 44px targets, no sideways scroll at 360px", async ({ page, snap }) => {
    await newCustomer(page);
    await open(page, "/app/account");
    await expect(page.locator("html")).toHaveAttribute("lang", "th");
    await expect(page.getByText("อีเมลเข้าสู่ระบบ")).toBeVisible();
    await expect(page.getByText("รูปโปรไฟล์")).toBeVisible();
    await expect(page.getByRole("heading", { name: "ข่าวสารและโปรโมชัน" })).toBeVisible();
    await expect(page.getByText("Sign-in email")).toHaveCount(0);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "page is wider than the screen").toBeLessThanOrEqual(0);

    const tooSmall: string[] = [];
    const check = async (locator: Locator, what: string) => {
      const count = await locator.count();
      for (let i = 0; i < count; i += 1) {
        const item = locator.nth(i);
        if (!(await item.isVisible())) continue;
        const box = await item.boundingBox();
        if (box && box.height < 43.5) tooSmall.push(`${what} #${i} is ${Math.round(box.height)}px tall`);
      }
    };
    for (const scope of ["main form", '[data-testid="email-card"]', '[data-testid="photo-card"]', '[data-testid="service-prefs-card"]', '[data-testid="marketing-card"]']) {
      const root = page.locator(scope).first();
      await check(root.locator("button:not([role=switch]), input:not(.sr-only):not([type=hidden])"), `${scope} control`);
    }
    expect(tooSmall, tooSmall.join("; ")).toEqual([]);
    // The switch track is 32px with a 44px hit area; its row is what must be 44px.
    for (const id of ["#pref-confirmations", "#pref-reminders", "#pref-marketing"]) {
      const hit = await page.locator(id).evaluate((el) => {
        const row = el.parentElement!;
        return row.getBoundingClientRect().height;
      });
      expect(hit, `${id} row`).toBeGreaterThanOrEqual(43.5);
    }
    await snap(page, "Thai account at 360px");
  });
});
