// Runs once when the Next.js server starts. Billing cannot go live in this build:
// refuse to boot if BILLING_LIVE is set to anything but false.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertBillingNotLive } = await import("@/lib/billing/provider");
    assertBillingNotLive();
  }
}
