// Subscription state machine. Pure functions: no clock, no database, no network.
// Every time-based rule takes `now` and works on Asia/Bangkok calendar days.
//
// Timeline for a payment due on day D (Legal handoff 02 section C, decision 25):
//   D-3   reminder (once)
//   D     the charge is attempted; if it fails (or D passes unpaid) -> past_due
//   D+6   provider retries (D+1, D+3, D+5) are over -> grace
//   D+15  00:00 Bangkok (end of day D+14) -> automatic drop to Free (downgraded)
// Paid extras keep working through past_due and grace. Customers never see any
// of this: nothing here touches a shop's booking page (see BillingAction).
import { PLANS, periodPriceSatang, periodStart, type PlanId } from "./plans";
import { addDays, bangkokDate, daysBetween, startOfBangkokDay, type BDate } from "./time";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "grace" | "downgraded" | "cancelled";

export const REMINDER_DAYS_BEFORE = 3;
export const RETRY_DAYS = 5; // provider retries on D+1, D+3, D+5; grace label starts after
export const GRACE_DAYS = 14; // everything works through day D+14
export const DUNNING_DAYS = [0, 3, 7] as const; // owner emails after a failed charge

export interface Subscription {
  businessId: string;
  /** Plan being paid for; "free" once downgraded or cancelled. */
  planId: PlanId;
  /** What they were on before a downgrade/cancel, to offer re-subscribing. */
  previousPlanId: PlanId | null;
  status: SubscriptionStatus;
  founding: boolean;
  /** Date billing started; all period boundaries count from here. */
  anchor: BDate;
  /** Index of the period currently paid for (or free). */
  periodIndex: number;
  /** Date the next period (periodIndex + 1) must be paid. */
  dueDate: BDate;
  /** Instant the grace period ends (00:00 Bangkok of due + 15); null unless past_due/grace. */
  graceUntil: Date | null;
  reminderSentFor: BDate | null;
  dunningSent: number[];
  cancelAtPeriodEnd: boolean;
}

/**
 * What the billing job asks the outside world to do. By design there is no
 * unpublish / suspend / block-bookings action: Free is enforced by barber
 * limits and paid extras only.
 */
export type BillingAction =
  | { type: "send_reminder"; dueDate: BDate; amountSatang: number }
  | { type: "send_dunning"; dueDate: BDate; dayOffset: number; graceUntil: Date }
  | { type: "downgrade_to_free"; from: PlanId; reason: "non_payment" | "cancelled" }
  | { type: "issue_invoice"; periodIndex: number; amountSatang: number };

export interface Step {
  sub: Subscription;
  actions: BillingAction[];
}

export class BillingStateError extends Error {}

const PAID_STATES: SubscriptionStatus[] = ["trialing", "active", "past_due", "grace"];
const isPaidState = (s: SubscriptionStatus) => PAID_STATES.includes(s);

export function startSubscription(input: {
  businessId: string;
  plan: PlanId;
  founding?: boolean;
  today: BDate;
}): Subscription {
  const founding = input.founding ?? false;
  // Throws for a founding offer on anything but Pro.
  const first = periodPriceSatang(input.plan, founding, 0);
  if (input.plan === "free" && founding) throw new BillingStateError("Free has no founding offer");
  return {
    businessId: input.businessId,
    planId: input.plan,
    previousPlanId: null,
    status: input.plan === "free" ? "active" : founding && first === 0 ? "trialing" : "active",
    founding,
    anchor: input.today,
    periodIndex: 0,
    dueDate: periodStart(input.today, 1),
    graceUntil: null,
    reminderSentFor: null,
    dunningSent: [],
    cancelAtPeriodEnd: false,
  };
}

/** The plan whose limits apply right now. Pure function of the owner's data. */
export function effectivePlanId(sub: Subscription | null, now: Date): PlanId {
  if (!sub) return "free";
  if (sub.status === "downgraded" || sub.status === "cancelled") return "free";
  if ((sub.status === "past_due" || sub.status === "grace") && sub.graceUntil && now >= sub.graceUntil) return "free";
  return sub.planId;
}

/** Amount due on the subscription's due date. */
export const amountDueSatang = (sub: Subscription): number =>
  periodPriceSatang(sub.planId, sub.founding, sub.periodIndex + 1);

const clone = (s: Subscription): Subscription => ({ ...s, dunningSent: [...s.dunningSent] });

function graceEnd(dueDate: BDate): Date {
  return startOfBangkokDay(addDays(dueDate, GRACE_DAYS + 1));
}

function lapse(sub: Subscription, reason: "non_payment" | "cancelled", status: "downgraded" | "cancelled"): BillingAction {
  const from = sub.planId;
  sub.previousPlanId = from;
  sub.planId = "free";
  sub.status = status;
  sub.graceUntil = null;
  sub.cancelAtPeriodEnd = false;
  return { type: "downgrade_to_free", from, reason };
}

/**
 * The periodic job. Safe to run any number of times: a second run at the same
 * instant (or later, with nothing new due) returns no actions.
 */
export function tick(input: Subscription, now: Date): Step {
  const sub = clone(input);
  const actions: BillingAction[] = [];
  if (!isPaidState(sub.status) || sub.planId === "free") return { sub, actions };
  const today = bangkokDate(now);

  // Free founding months roll over with no charge and no invoice.
  while (
    (sub.status === "trialing" || sub.status === "active") &&
    today >= sub.dueDate &&
    amountDueSatang(sub) === 0
  ) {
    sub.periodIndex += 1;
    sub.dueDate = periodStart(sub.anchor, sub.periodIndex + 1);
    sub.reminderSentFor = null;
  }

  // The owner cancelled: the paid period runs out, then Free. No further charge.
  if (sub.cancelAtPeriodEnd && today >= sub.dueDate) {
    actions.push(lapse(sub, "cancelled", "cancelled"));
    return { sub, actions };
  }

  // Reminder, once, from 3 days before the due date up to the due date.
  const left = daysBetween(today, sub.dueDate);
  if (
    (sub.status === "trialing" || sub.status === "active") &&
    !sub.cancelAtPeriodEnd &&
    left >= 0 &&
    left <= REMINDER_DAYS_BEFORE &&
    sub.reminderSentFor !== sub.dueDate
  ) {
    sub.reminderSentFor = sub.dueDate;
    actions.push({ type: "send_reminder", dueDate: sub.dueDate, amountSatang: amountDueSatang(sub) });
  }

  // A due date that passed with no payment and no recorded failure.
  if ((sub.status === "trialing" || sub.status === "active") && today > sub.dueDate) {
    sub.status = "past_due";
    sub.graceUntil = graceEnd(sub.dueDate);
  }

  if (sub.status === "past_due" && today >= addDays(sub.dueDate, RETRY_DAYS + 1)) sub.status = "grace";

  // Grace over -> quiet drop to Free.
  if ((sub.status === "past_due" || sub.status === "grace") && sub.graceUntil && now >= sub.graceUntil) {
    actions.push(lapse(sub, "non_payment", "downgraded"));
    return { sub, actions };
  }

  // Owner emails after a failed charge: days 0, 3 and 7, each once.
  if ((sub.status === "past_due" || sub.status === "grace") && sub.graceUntil) {
    const offset = daysBetween(sub.dueDate, today);
    for (const d of DUNNING_DAYS) {
      if (offset >= d && !sub.dunningSent.includes(d) && !DUNNING_DAYS.some((x) => x > d && offset >= x)) {
        sub.dunningSent.push(d);
        actions.push({ type: "send_dunning", dueDate: sub.dueDate, dayOffset: d, graceUntil: sub.graceUntil });
      }
    }
  }
  return { sub, actions };
}

/** The charge on/after the due date succeeded. */
export function paymentSucceeded(input: Subscription): Step {
  if (!isPaidState(input.status)) throw new BillingStateError(`Cannot take payment while ${input.status}; re-subscribe first`);
  const sub = clone(input);
  const amount = amountDueSatang(sub);
  sub.periodIndex += 1;
  sub.dueDate = periodStart(sub.anchor, sub.periodIndex + 1);
  sub.status = "active";
  sub.graceUntil = null;
  sub.reminderSentFor = null;
  sub.dunningSent = [];
  const actions: BillingAction[] = amount > 0 ? [{ type: "issue_invoice", periodIndex: sub.periodIndex, amountSatang: amount }] : [];
  return { sub, actions };
}

/** The charge failed (declined, or the provider reported failure after retries). */
export function paymentFailed(input: Subscription, now: Date): Step {
  if (!isPaidState(input.status)) throw new BillingStateError(`Cannot fail a payment while ${input.status}`);
  const sub = clone(input);
  if (sub.status === "trialing" || sub.status === "active") {
    sub.status = "past_due";
    sub.graceUntil = graceEnd(sub.dueDate);
  }
  return tick(sub, now);
}

/** Owner cancels: effective at the end of the paid period. */
export function cancel(input: Subscription): Subscription {
  if (!isPaidState(input.status) || input.planId === "free") throw new BillingStateError(`Nothing to cancel while ${input.status}`);
  return { ...clone(input), cancelAtPeriodEnd: true };
}

export function undoCancel(input: Subscription): Subscription {
  if (!input.cancelAtPeriodEnd) throw new BillingStateError("This subscription is not set to cancel");
  return { ...clone(input), cancelAtPeriodEnd: false };
}

/** Back from Free/cancelled onto a paid plan. The caller takes the first payment first. */
export function resubscribe(input: Subscription, plan: PlanId, today: BDate): Subscription {
  if (input.status !== "downgraded" && input.status !== "cancelled") {
    throw new BillingStateError(`Already subscribed (${input.status})`);
  }
  if (plan === "free") throw new BillingStateError("Choose a paid plan");
  return { ...startSubscription({ businessId: input.businessId, plan, today }), status: "active" };
}

export const planLimit = (sub: Subscription | null, now: Date): number => PLANS[effectivePlanId(sub, now)].maxBarbers;
