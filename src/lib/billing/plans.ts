// Plans and prices. CEO-approved, company/decisions.md #25 (3 Nov 2026).
// Money is integer satang (THB x 100) everywhere: no floating point in billing.
// Prices are what the shop pays. While TatNat is not VAT-registered no VAT is
// added or shown; once registered the same price becomes VAT-inclusive (invoice.ts).
import { addMonths, type BDate } from "./time";

export type PlanId = "free" | "pro" | "studio";

export interface Plan {
  id: PlanId;
  nameEn: string;
  nameTh: string;
  priceSatang: number; // per month
  maxBarbers: number;
  /** Paid extras (broadcast, notes/CRM, support). Free has none. */
  paidExtras: boolean;
}

export const thb = (baht: number): number => Math.round(baht * 100);

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", nameEn: "Free", nameTh: "ฟรี", priceSatang: thb(0), maxBarbers: 2, paidExtras: false },
  pro: { id: "pro", nameEn: "Pro", nameTh: "โปร", priceSatang: thb(490), maxBarbers: 5, paidExtras: true },
  studio: { id: "studio", nameEn: "Studio", nameTh: "สตูดิโอ", priceSatang: thb(990), maxBarbers: 15, paidExtras: true },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && v in PLANS;

/** There is no per-booking fee, ever (decision 25). Kept as data so a test can pin it. */
export const PER_BOOKING_FEE_SATANG = 0;

export const FOUNDING = {
  plan: "pro" as PlanId,
  freeMonths: 3,
  discountedMonths: 12,
  discountedPriceSatang: thb(290),
} as const;

/**
 * Price of billing period `index` (0-based) on a plan. Founding: periods 0-2
 * free, 3-14 at THB 290, then the list price. Only Pro has a founding offer.
 */
export function periodPriceSatang(plan: PlanId, founding: boolean, index: number): number {
  if (!Number.isInteger(index) || index < 0) throw new RangeError("period index must be a whole number >= 0");
  if (founding) {
    if (plan !== FOUNDING.plan) throw new Error("The founding offer applies to Pro only");
    if (index < FOUNDING.freeMonths) return 0;
    if (index < FOUNDING.freeMonths + FOUNDING.discountedMonths) return FOUNDING.discountedPriceSatang;
  }
  return PLANS[plan].priceSatang;
}

/** Period `index` starts on this Bangkok date (counted from the anchor, day clamped). */
export const periodStart = (anchor: BDate, index: number): BDate => addMonths(anchor, index);

export const barberLimit = (plan: PlanId): number => PLANS[plan].maxBarbers;
export const canAddBarber = (plan: PlanId, activeBarbers: number): boolean => activeBarbers < PLANS[plan].maxBarbers;

/** Which barbers stay active on a downgrade: the owner's choice, else the oldest. */
export function barbersToKeep(
  active: { id: string; createdAt: string }[],
  limit: number,
  ownerChoice?: string[],
): string[] {
  const ids = new Set(active.map((b) => b.id));
  const chosen = (ownerChoice ?? []).filter((id) => ids.has(id)).slice(0, limit);
  if (chosen.length === limit) return chosen;
  const rest = [...active]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((b) => b.id)
    .filter((id) => !chosen.includes(id));
  return [...chosen, ...rest].slice(0, limit);
}
