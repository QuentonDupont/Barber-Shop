import { describe, expect, it } from "vitest";
import { startSubscription } from "./state";
import { billingNotice, barbersToDeactivate, isUrgent, previewPlanChange, simulateScenario } from "./ui";

const NOW = new Date("2026-11-03T05:00:00Z"); // 12:00 Bangkok
const pro = () => startSubscription({ businessId: "b", plan: "pro", today: "2026-10-20" });

describe("previewPlanChange", () => {
  it("Free to Pro charges THB 490 now; with the founding offer it charges nothing and starts founding", () => {
    const free = null;
    const normal = previewPlanChange({ sub: free, now: NOW, target: "pro", activeBarbers: 2, foundingOffered: false });
    expect(normal).toMatchObject({ kind: "upgrade", chargeNowSatang: 49000, startsFounding: false });
    const founding = previewPlanChange({ sub: free, now: NOW, target: "pro", activeBarbers: 2, foundingOffered: true });
    expect(founding).toMatchObject({ kind: "upgrade", chargeNowSatang: 0, startsFounding: true });
  });
  it("the founding offer is Pro only and only from Free", () => {
    expect(previewPlanChange({ sub: null, now: NOW, target: "studio", activeBarbers: 1, foundingOffered: true }).startsFounding).toBe(false);
    expect(previewPlanChange({ sub: pro(), now: NOW, target: "studio", activeBarbers: 1, foundingOffered: true }).startsFounding).toBe(false);
  });
  it("Pro to Studio is an upgrade at THB 990; Studio to Free asks who stays when there are too many barbers", () => {
    expect(previewPlanChange({ sub: pro(), now: NOW, target: "studio", activeBarbers: 3, foundingOffered: false })).toMatchObject({ kind: "upgrade", chargeNowSatang: 99000 });
    const down = previewPlanChange({ sub: pro(), now: NOW, target: "free", activeBarbers: 4, foundingOffered: false });
    expect(down).toMatchObject({ kind: "downgrade", chargeNowSatang: 0, mustChooseBarbers: true, barbersToDeactivate: 2, newLimit: 2 });
  });
  it("same plan is a no-op; a founding shop moving to Studio loses the founding price", () => {
    expect(previewPlanChange({ sub: pro(), now: NOW, target: "pro", activeBarbers: 1, foundingOffered: false }).kind).toBe("same");
    const f = startSubscription({ businessId: "b", plan: "pro", founding: true, today: "2026-10-20" });
    expect(previewPlanChange({ sub: f, now: NOW, target: "studio", activeBarbers: 1, foundingOffered: false }).losesFounding).toBe(true);
  });
});

describe("barbersToDeactivate", () => {
  const staff = [
    { id: "a", createdAt: "2026-01-01" },
    { id: "b", createdAt: "2026-02-01" },
    { id: "c", createdAt: "2026-03-01" },
  ];
  it("keeps the owner's choice, else the oldest, and deletes nobody", () => {
    expect(barbersToDeactivate(staff, 2)).toEqual(["c"]);
    expect(barbersToDeactivate(staff, 2, ["c", "b"])).toEqual(["a"]);
  });
});

describe("billingNotice and demo scenarios", () => {
  it("a healthy shop has no notice until 3 days before the charge", () => {
    const s = startSubscription({ businessId: "b", plan: "pro", today: "2026-10-03" }); // due 2026-11-03
    expect(billingNotice(s, new Date("2026-10-20T05:00:00Z"))).toBeNull();
    expect(billingNotice(s, NOW)).toMatchObject({ kind: "upcoming", daysLeft: 0 });
    expect(isUrgent(billingNotice(s, NOW))).toBe(false);
  });
  it("a missed payment shows past_due, then grace with the last payable day, then downgraded", () => {
    const base = startSubscription({ businessId: "b", plan: "pro", today: "2026-09-03" });
    const failed = simulateScenario(base, "failed", NOW).sub;
    expect(failed.status).toBe("past_due");
    const n1 = billingNotice(failed, NOW)!;
    expect(n1).toMatchObject({ kind: "past_due", date: "2026-11-17" });
    expect(isUrgent(n1)).toBe(true);
    const grace = simulateScenario(base, "grace", NOW).sub;
    expect(billingNotice(grace, NOW)).toMatchObject({ kind: "grace", date: "2026-11-09", daysLeft: 6 });
    const lapsed = simulateScenario(base, "lapsed", NOW);
    expect(lapsed.sub.status).toBe("downgraded");
    expect(lapsed.sub.planId).toBe("free");
    expect(lapsed.actions.some((a) => a.type === "downgrade_to_free")).toBe(true);
    expect(billingNotice(lapsed.sub, NOW)).toMatchObject({ kind: "downgraded", fromPlan: "pro" });
  });
  it("reset restores a lapsed shop to its old plan, active", () => {
    const base = startSubscription({ businessId: "b", plan: "pro", today: "2026-09-03" });
    const lapsed = simulateScenario(base, "lapsed", NOW).sub;
    const back = simulateScenario(lapsed, "reset", NOW).sub;
    expect(back).toMatchObject({ planId: "pro", status: "active", graceUntil: null });
  });
  it("cancelling shows the end date", () => {
    const s = { ...pro(), cancelAtPeriodEnd: true };
    expect(billingNotice(s, NOW)).toMatchObject({ kind: "cancelling", date: s.dueDate });
  });
});
