// Pure helpers for the owner billing screens: what a plan change does, which
// notice the owner sees, and the demo "what if payment fails" scenarios.
// No database, no clock (callers pass `now`), nothing here is shown to customers.
import { FOUNDING, PLANS, barbersToKeep, periodPriceSatang, type PlanId } from "./plans";
import {
  effectivePlanId,
  paymentFailed,
  tick,
  type BillingAction,
  type Subscription,
} from "./state";
import { addDays, bangkokDate, daysBetween, startOfBangkokDay, type BDate } from "./time";

export type PlanChangeKind = "same" | "upgrade" | "downgrade";

export interface PlanChangePreview {
  kind: PlanChangeKind;
  from: PlanId;
  to: PlanId;
  /** Charged today to the demo card, in satang. 0 = nothing to pay now. */
  chargeNowSatang: number;
  /** The founding offer would be used (Pro only, once). */
  startsFounding: boolean;
  /** A founding shop leaves the founding price by moving off Pro. */
  losesFounding: boolean;
  /** Active barbers beyond the new limit: the owner must choose who stays. */
  mustChooseBarbers: boolean;
  /** How many barbers must go inactive. */
  barbersToDeactivate: number;
  newLimit: number;
}

const rank = (p: PlanId) => PLANS[p].priceSatang;

export function previewPlanChange(input: {
  sub: Subscription | null;
  now: Date;
  target: PlanId;
  activeBarbers: number;
  foundingOffered: boolean;
}): PlanChangePreview {
  const from = effectivePlanId(input.sub, input.now);
  const to = input.target;
  const kind: PlanChangeKind = to === from ? "same" : rank(to) > rank(from) ? "upgrade" : "downgrade";
  const startsFounding = kind === "upgrade" && to === FOUNDING.plan && from === "free" && input.foundingOffered;
  const newLimit = PLANS[to].maxBarbers;
  const over = Math.max(0, input.activeBarbers - newLimit);
  return {
    kind,
    from,
    to,
    chargeNowSatang: kind === "same" || to === "free" ? 0 : periodPriceSatang(to, startsFounding, 0),
    startsFounding,
    losesFounding: !!input.sub?.founding && to !== FOUNDING.plan,
    mustChooseBarbers: over > 0,
    barbersToDeactivate: over,
    newLimit,
  };
}

/** Which barbers to switch off for a new limit: the owner's choice first, else the oldest stay. */
export function barbersToDeactivate(
  active: { id: string; createdAt: string }[],
  newLimit: number,
  ownerChoice?: string[],
): string[] {
  const keep = new Set(barbersToKeep(active, newLimit, ownerChoice));
  return active.filter((b) => !keep.has(b.id)).map((b) => b.id);
}

export type NoticeKind = "past_due" | "grace" | "downgraded" | "cancelling" | "upcoming";

export interface BillingNotice {
  kind: NoticeKind;
  /** past_due/grace: last day it can still be paid; cancelling/upcoming: the date it happens. */
  date: BDate | null;
  daysLeft: number | null;
  /** Plan the shop was on before it dropped to Free. */
  fromPlan: PlanId | null;
}

/** The one notice the owner (and only the owner) should see, or null. */
export function billingNotice(sub: Subscription | null, now: Date): BillingNotice | null {
  if (!sub) return null;
  const today = bangkokDate(now);
  if ((sub.status === "past_due" || sub.status === "grace") && sub.graceUntil) {
    if (now >= sub.graceUntil) return { kind: "downgraded", date: null, daysLeft: null, fromPlan: sub.planId };
    const last = addDays(bangkokDate(sub.graceUntil), -1);
    return { kind: sub.status, date: last, daysLeft: Math.max(0, daysBetween(today, last)), fromPlan: null };
  }
  if (sub.status === "downgraded" && sub.previousPlanId) {
    return { kind: "downgraded", date: null, daysLeft: null, fromPlan: sub.previousPlanId };
  }
  if ((sub.status === "active" || sub.status === "trialing") && sub.planId !== "free") {
    if (sub.cancelAtPeriodEnd) return { kind: "cancelling", date: sub.dueDate, daysLeft: daysBetween(today, sub.dueDate), fromPlan: null };
    const left = daysBetween(today, sub.dueDate);
    if (left >= 0 && left <= 3) return { kind: "upcoming", date: sub.dueDate, daysLeft: left, fromPlan: null };
  }
  return null;
}

/** Only these notices interrupt the owner on every dashboard page. */
export const isUrgent = (n: BillingNotice | null): boolean =>
  !!n && (n.kind === "past_due" || n.kind === "grace" || n.kind === "downgraded");

export type DemoScenario = "failed" | "grace" | "lapsed" | "reset";

/**
 * Demo controls: run the real state machine through a missed payment so the
 * notices can be seen. `failed` = due today and declined; `grace` = declined 8
 * days ago; `lapsed` = declined 15 days ago. `reset` puts a paid shop back to normal.
 */
export function simulateScenario(
  sub: Subscription,
  scenario: DemoScenario,
  now: Date,
): { sub: Subscription; actions: BillingAction[] } {
  if (sub.planId === "free" && scenario !== "reset") {
    throw new Error("Nothing to simulate on the Free plan");
  }
  if (scenario === "reset") {
    const planId = sub.status === "downgraded" || sub.status === "cancelled" ? (sub.previousPlanId ?? sub.planId) : sub.planId;
    return {
      sub: {
        ...sub,
        planId,
        status: "active",
        graceUntil: null,
        dunningSent: [],
        reminderSentFor: null,
        dueDate: addDays(bangkokDate(now), 30),
        cancelAtPeriodEnd: false,
      },
      actions: [],
    };
  }
  const daysAgo = scenario === "failed" ? 0 : scenario === "grace" ? 8 : 15;
  const dueDay = addDays(bangkokDate(now), -daysAgo);
  const failedAt = new Date(startOfBangkokDay(dueDay).getTime() + 3_600_000);
  const base: Subscription = { ...sub, dueDate: dueDay, status: sub.status === "trialing" ? "trialing" : "active", graceUntil: null };
  const first = paymentFailed(base, failedAt);
  const rolled = tick(first.sub, now);
  return { sub: rolled.sub, actions: [...first.actions, ...rolled.actions] };
}
