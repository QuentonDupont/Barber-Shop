/**
 * Plan table for the public About page (decisions #24 and #25, approved 3 Nov
 * 2026). Prices live here, not in the markup, so Finance can change a number
 * without touching the page. Paid plans are NOT on sale yet: the page says so
 * under the table (Legal) and the paid-plan button stays disabled until the CEO
 * approves real charging.
 */
export const PAID_PLANS_ON_SALE = false;

export const PLANS = [
  { id: "free", pricePerMonth: 0, barbers: 2 },
  { id: "pro", pricePerMonth: 490, barbers: 5 },
  { id: "studio", pricePerMonth: 990, barbers: 15 },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

/** Founding shops: Pro free for 3 months, then 290 a month for 12 months, then list price. */
export const FOUNDING = { freeMonths: 3, introPrice: 290, introMonths: 12 } as const;
