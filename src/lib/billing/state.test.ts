import { describe, expect, it } from "vitest";
import {
  BillingStateError, cancel, effectivePlanId, paymentFailed, paymentSucceeded, resubscribe, startSubscription, tick,
  undoCancel, type BillingAction, type Subscription,
} from "./state";

const at = (iso: string) => new Date(iso);
// Bangkok noon on a date (05:00Z) / Bangkok 00:00 on a date (17:00Z the day before)
const noon = (d: string) => at(`${d}T05:00:00+00:00`);
const pro = (anchor: string, extra: Partial<Subscription> = {}): Subscription => ({
  ...startSubscription({ businessId: "b1", plan: "pro", today: anchor }),
  ...extra,
});
const founding = (anchor = "2026-11-03") => startSubscription({ businessId: "b1", plan: "pro", founding: true, today: anchor });

describe("founding schedule", () => {
  it("starts trialing, rolls the free months with no charge, first charge due month 4", () => {
    let s = founding();
    expect(s.status).toBe("trialing");
    expect(s.dueDate).toBe("2026-12-03");
    s = tick(s, noon("2027-01-10")).sub;
    expect(s.periodIndex).toBe(2);
    expect(s.dueDate).toBe("2027-02-03");
    expect(s.status).toBe("trialing");
    const r = tick(s, noon("2027-01-10"));
    expect(r.actions).toEqual([]); // 24 days ahead: nothing yet
  });
  it("first payment at trial end becomes active at THB 290, next due a month on", () => {
    const s = tick(founding(), noon("2027-02-03")).sub;
    const p = paymentSucceeded(s);
    expect(p.sub.status).toBe("active");
    expect(p.sub.periodIndex).toBe(3);
    expect(p.sub.dueDate).toBe("2027-03-03");
    expect(p.actions).toEqual([{ type: "issue_invoice", periodIndex: 3, amountSatang: 29_000 }]);
  });
  it("after 12 discounted months the list price applies", () => {
    let s = tick(founding(), noon("2027-02-03")).sub;
    for (let i = 0; i < 12; i++) s = paymentSucceeded(s).sub; // periods 3..14
    expect(s.periodIndex).toBe(14);
    const last = paymentSucceeded(s);
    expect(last.actions).toEqual([{ type: "issue_invoice", periodIndex: 15, amountSatang: 49_000 }]);
  });
  it("a founding shop that cancels during the free months keeps them", () => {
    let s = cancel(founding());
    s = tick(s, noon("2027-01-20")).sub;
    expect(s.status).toBe("trialing");
    const end = tick(s, noon("2027-02-03"));
    expect(end.sub.status).toBe("cancelled");
    expect(end.actions).toEqual([{ type: "downgrade_to_free", from: "pro", reason: "cancelled" }]);
  });
});

describe("reminder", () => {
  const s = pro("2026-03-10"); // next due 2026-04-10
  it("not before 3 days out", () => expect(tick(s, noon("2026-04-06")).actions).toEqual([]));
  it("once, from 3 days before", () => {
    const r = tick(s, noon("2026-04-07"));
    expect(r.actions).toEqual([{ type: "send_reminder", dueDate: "2026-04-10", amountSatang: 49_000 }]);
    expect(tick(r.sub, noon("2026-04-08")).actions).toEqual([]);
    expect(tick(r.sub, noon("2026-04-07")).actions).toEqual([]);
  });
  it("uses the Bangkok day, not the UTC day", () => {
    // 2026-04-06 17:00Z is already 7 April in Bangkok
    expect(tick(s, at("2026-04-06T17:00:00Z")).actions).toHaveLength(1);
    expect(tick(s, at("2026-04-06T16:59:00Z")).actions).toHaveLength(0);
  });
  it("none for Free or for a shop that cancelled", () => {
    expect(tick(startSubscription({ businessId: "b", plan: "free", today: "2026-03-10" }), noon("2026-04-09")).actions).toEqual([]);
    expect(tick(cancel(s), noon("2026-04-08")).actions).toEqual([]);
  });
});

describe("failed payment, grace and downgrade (Bangkok time)", () => {
  const due = "2026-04-10";
  const failed = () => paymentFailed(pro("2026-03-10"), noon(due));
  it("a decline on the due date goes past_due with the grace end at 00:00 Bangkok of day 15", () => {
    const f = failed();
    expect(f.sub.status).toBe("past_due");
    expect(f.sub.graceUntil?.toISOString()).toBe("2026-04-24T17:00:00.000Z"); // 25 Apr 00:00 Bangkok
    expect(f.actions.map((a) => a.type)).toEqual(["send_dunning"]);
  });
  it("paid extras keep working until the last second of day 14", () => {
    const f = failed().sub;
    expect(effectivePlanId(f, at("2026-04-24T16:59:59Z"))).toBe("pro");
    expect(effectivePlanId(f, at("2026-04-24T17:00:00Z"))).toBe("free"); // lazy, even before the job runs
    expect(tick(f, at("2026-04-24T16:59:59Z")).sub.status).toBe("grace");
  });
  it("becomes grace after the provider's retries (day 6), keeps pro", () => {
    const f = failed().sub;
    expect(tick(f, noon("2026-04-15")).sub.status).toBe("past_due");
    const g = tick(f, noon("2026-04-16")).sub;
    expect(g.status).toBe("grace");
    expect(effectivePlanId(g, noon("2026-04-16"))).toBe("pro");
  });
  it("downgrades to Free at 00:00 Bangkok of day 15, and says so once", () => {
    const f = failed().sub;
    const d = tick(f, at("2026-04-24T17:00:00Z"));
    expect(d.sub.status).toBe("downgraded");
    expect(d.sub.planId).toBe("free");
    expect(d.sub.previousPlanId).toBe("pro");
    expect(d.actions).toEqual([{ type: "downgrade_to_free", from: "pro", reason: "non_payment" }]);
    expect(tick(d.sub, at("2026-04-30T00:00:00Z")).actions).toEqual([]);
  });
  it("dunning emails on days 0, 3 and 7, each once", () => {
    let s = failed().sub;
    const sent: number[] = [];
    for (const day of ["2026-04-10", "2026-04-11", "2026-04-13", "2026-04-14", "2026-04-17", "2026-04-18", "2026-04-20"]) {
      const r = tick(s, noon(day));
      s = r.sub;
      for (const a of r.actions) if (a.type === "send_dunning") sent.push(a.dayOffset);
    }
    expect(sent).toEqual([3, 7]); // day 0 was already sent by paymentFailed
  });
  it("a due date that simply passes unpaid becomes past_due the next day", () => {
    const s = pro("2026-03-10");
    expect(tick(s, noon("2026-04-10")).sub.status).toBe("active"); // charge attempted today
    const p = tick(s, noon("2026-04-11"));
    expect(p.sub.status).toBe("past_due");
    expect(p.sub.graceUntil?.toISOString()).toBe("2026-04-24T17:00:00.000Z");
  });
  it("paying in grace restores active and moves the due date on", () => {
    const g = tick(failed().sub, noon("2026-04-18")).sub;
    expect(g.status).toBe("grace");
    const p = paymentSucceeded(g);
    expect(p.sub.status).toBe("active");
    expect(p.sub.graceUntil).toBeNull();
    expect(p.sub.dueDate).toBe("2026-05-10");
    expect(p.sub.dunningSent).toEqual([]);
  });
  it("re-subscribing after a downgrade is active at once", () => {
    const d = tick(failed().sub, at("2026-04-25T00:00:00Z")).sub;
    const r = resubscribe(d, "pro", "2026-05-02");
    expect(r.status).toBe("active");
    expect(r.planId).toBe("pro");
    expect(r.dueDate).toBe("2026-06-02");
    expect(() => resubscribe(r, "pro", "2026-05-03")).toThrow(BillingStateError);
  });
});

describe("cancel", () => {
  it("runs to the end of the paid period, then Free; undo works before that", () => {
    const s = cancel(pro("2026-03-10"));
    expect(tick(s, noon("2026-04-09")).sub.status).toBe("active");
    expect(effectivePlanId(s, noon("2026-04-09"))).toBe("pro");
    expect(tick(undoCancel(s), noon("2026-04-10")).sub.cancelAtPeriodEnd).toBe(false);
    const end = tick(s, noon("2026-04-10"));
    expect(end.sub.status).toBe("cancelled");
    expect(effectivePlanId(end.sub, noon("2026-04-10"))).toBe("free");
    expect(end.actions).toEqual([{ type: "downgrade_to_free", from: "pro", reason: "cancelled" }]);
  });
  it("illegal moves throw", () => {
    const c = tick(cancel(pro("2026-03-10")), noon("2026-04-10")).sub;
    expect(() => paymentFailed(c, noon("2026-04-11"))).toThrow(BillingStateError);
    expect(() => paymentSucceeded(c)).toThrow(BillingStateError);
    expect(() => cancel(c)).toThrow(BillingStateError);
    expect(() => undoCancel(pro("2026-03-10"))).toThrow(BillingStateError);
  });
});

describe("job properties", () => {
  it("is idempotent at the same instant, at every stage", () => {
    const f = paymentFailed(pro("2026-03-10"), noon("2026-04-10")).sub;
    for (const t of ["2026-04-07", "2026-04-10", "2026-04-13", "2026-04-18", "2026-04-25", "2026-06-01"]) {
      const once = tick(f, noon(t));
      const twice = tick(once.sub, noon(t));
      expect(twice.actions).toEqual([]);
      expect(twice.sub).toEqual(once.sub);
    }
    const s = pro("2026-03-10");
    const once = tick(s, noon("2026-04-08"));
    expect(tick(once.sub, noon("2026-04-08")).actions).toEqual([]);
  });
  it("never produces an action that unpublishes or blocks a shop", () => {
    const allowed: BillingAction["type"][] = ["send_reminder", "send_dunning", "downgrade_to_free", "issue_invoice"];
    let s = pro("2026-03-10");
    const seen = new Set<string>();
    for (const t of ["2026-04-07", "2026-04-11", "2026-04-13", "2026-04-17", "2026-04-25", "2026-05-30"]) {
      const r = tick(s, noon(t));
      s = r.sub;
      r.actions.forEach((a) => seen.add(a.type));
    }
    expect([...seen].every((t) => allowed.includes(t as BillingAction["type"]))).toBe(true);
    expect(seen.has("downgrade_to_free")).toBe(true);
    expect(effectivePlanId(null, noon("2026-04-01"))).toBe("free");
  });
});

describe("founding first-charge reminders (Legal C)", () => {
  const withCard = () => startSubscription({ businessId: "b1", plan: "pro", founding: true, cardOnFile: true, today: "2026-11-03" });
  it("7 and 2 days before the first charge, each once, and no 3-day one", () => {
    let s = tick(withCard(), noon("2027-01-20")).sub; // roll to period 2, due 2027-02-03
    expect(s.dueDate).toBe("2027-02-03");
    const seen: number[] = [];
    for (const d of ["2027-01-26", "2027-01-27", "2027-01-30", "2027-01-31", "2027-02-01", "2027-02-02"]) {
      const r = tick(s, noon(d));
      s = r.sub;
      for (const a of r.actions) {
        expect(a.type).toBe("send_first_charge_reminder");
        if (a.type === "send_first_charge_reminder") seen.push(a.daysBefore);
      }
    }
    expect(seen).toEqual([7, 2]);
  });
  it("a founding shop with no card gets the ordinary 3-day reminder", () => {
    const s = tick(founding(), noon("2027-01-20")).sub;
    expect(tick(s, noon("2027-01-31")).actions.map((a) => a.type)).toEqual(["send_reminder"]);
  });
});
