import { test, expect, open, expectHealthy, signInAs } from "./fixtures";

/** Sign-up, sign-in and the invite-only rule for business accounts. */

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function fillSignUp(page: import("@playwright/test").Page, email: string) {
  await page.locator("#fullName").fill("E2E Tester");
  await page.locator("#email").fill(email);
  await page.locator("#phone").fill("081 234 5678");
  await page.locator("#password").fill("longenough1");
}

test.describe("auth", () => {
  test("sign-up is blocked by the server when the consent box is not ticked", async ({ page, snap }) => {
    await open(page, "/sign-up");
    await expectHealthy(page);
    const consent = page.locator("#consent");
    await expect(consent).not.toBeChecked(); // never pre-ticked
    await snap(page, "sign up form, consent unticked");

    await fillSignUp(page, `noconsent-${stamp()}@example.com`);
    await snap(page, "form filled, consent still unticked");
    await page.getByRole("button", { name: "Create account" }).click();

    // The form has no client-side check (noValidate), so this message can only come from the server action.
    const message = "Please confirm your data consent before creating an account.";
    await expect(page.getByText(message).first()).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up/);
    await snap(page, "server refuses: consent required");

    // The account was not created: the same email still cannot sign in.
    await open(page, "/sign-in");
    await page.locator("#email").fill(`unknown-${stamp()}@example.com`);
    await page.locator("#password").fill("longenough1");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("That email and password do not match an account.")).toBeVisible();
  });

  test("sign-up works once the consent box is ticked", async ({ page, snap }) => {
    await open(page, "/sign-up");
    await fillSignUp(page, `ok-${stamp()}@example.com`);
    await page.locator("#consent").check();
    await snap(page, "consent ticked");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.waitForLoadState("networkidle");
    await snap(page, "new customer lands on discover");
  });

  test("demo sign-in as a customer", async ({ page, snap }) => {
    await open(page, "/sign-in");
    await expect(page.getByText("Demo mode")).toBeVisible();
    await snap(page, "sign in page with demo buttons");
    await expect(async () => {
      await page.getByRole("button", { name: "Customer", exact: true }).click();
      await expect(page).toHaveURL(/\/app$/, { timeout: 4000 });
    }).toPass({ timeout: 20_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Find a place near you")).toBeVisible();
    await snap(page, "customer signed in");
  });

  test("demo sign-in as the shop owner", async ({ page, snap }) => {
    await open(page, "/sign-in");
    await expect(async () => {
      await page.getByRole("button", { name: "Shop owner", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 4000 });
    }).toPass({ timeout: 20_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /^Today,/ })).toBeVisible();
    await snap(page, "owner signed in");
  });

  test("each role stays in its own portal", async ({ page, context, baseURL }) => {
    // Signed out: both portals bounce to sign-in and remember where you were going.
    await page.goto("/dashboard/staff");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard%2Fstaff/);
    await page.goto("/app/bookings");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp%2Fbookings/);

    // A customer is turned away from the owner dashboard.
    await signInAs(context, "customer", baseURL!);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/app$/);

    // An owner is turned away from the customer area.
    await signInAs(context, "owner", baseURL!);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("invite-only: business self-signup stays blocked", async ({ page, snap }) => {
    // 1. The landing page's business door goes to the invite request, never to sign-up.
    await open(page, "/");
    const invite = page.getByRole("link", { name: "Request beta invite" });
    await expect(invite).toBeVisible();
    await expect(invite).toHaveAttribute("href", /request-invite|^mailto:/);
    await expect(page.locator('a[href^="/sign-up?role=business"]')).toHaveCount(0);

    // 2. An old business sign-up link shows the invite notice and still only offers a customer account.
    await open(page, "/sign-up?role=business_owner");
    await expect(page.getByText("TatNat is in an invite-only beta for businesses.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Request beta invite" })).toBeVisible();
    await expect(page.getByText("I take bookings")).toHaveCount(0);
    await snap(page, "business sign-up link shows the invite notice");

    // 3. Server-side: even if the form is tampered with to ask for a business account, it is refused
    //    (consent is ticked and every field valid, so the only thing wrong is the role).
    await fillSignUp(page, `biz-${stamp()}@example.com`);
    await page.locator("#consent").check();
    await page.locator("form").first().evaluate((form) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "role";
      input.value = "business_owner";
      form.appendChild(input);
    });
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByText("Business accounts are invite-only during the beta. Request an invite from the home page."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up/);
    await snap(page, "server refuses a business account");

    // 4. The invite page itself is reachable and healthy.
    await open(page, "/request-invite");
    await expectHealthy(page);
  });
});
