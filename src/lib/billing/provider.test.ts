import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InvoiceNumberer } from "./invoice";
import {
  assertBillingNotLive, BillingLiveError, createPaymentProvider, MockPaymentProvider, ProviderTimeoutError,
} from "./provider";
import { collectDue } from "./service";
import { startSubscription } from "./state";

const req = (key = "k1", amountSatang = 49_000) => ({ businessId: "b1", amountSatang, currency: "THB" as const, description: "t", idempotencyKey: key });

describe("mock provider", () => {
  it("succeeds, declines and times out on script", async () => {
    const p = new MockPaymentProvider().willReturn("b1", "succeeded", "declined", "timeout");
    expect((await p.charge(req("a"))).status).toBe("succeeded");
    expect(await p.charge(req("b"))).toMatchObject({ status: "failed", reason: "declined" });
    await expect(p.charge(req("c"))).rejects.toBeInstanceOf(ProviderTimeoutError);
    expect(p.live).toBe(false);
  });
  it("never charges the same idempotency key twice", async () => {
    const p = new MockPaymentProvider();
    const a = await p.charge(req("same"));
    const b = await p.charge(req("same"));
    expect(b).toEqual(a);
    expect(p.succeededCount).toBe(1);
  });
  it("rejects zero and fractional amounts", async () => {
    const p = new MockPaymentProvider();
    await expect(p.charge(req("z", 0))).rejects.toThrow();
    await expect(p.charge(req("f", 10.5))).rejects.toThrow();
  });
});

describe("BILLING_LIVE guard", () => {
  it("unset, empty, false and 0 are fine", () => {
    for (const v of [undefined, "", "false", "FALSE", "0"]) expect(() => assertBillingNotLive({ BILLING_LIVE: v })).not.toThrow();
    expect(createPaymentProvider({}).name).toBe("mock");
  });
  it("anything else refuses to run, and the factory builds nothing", () => {
    for (const v of ["true", "1", "yes", "live"]) {
      expect(() => assertBillingNotLive({ BILLING_LIVE: v })).toThrow(BillingLiveError);
      expect(() => createPaymentProvider({ BILLING_LIVE: v })).toThrow(BillingLiveError);
    }
  });
  it("the mock itself refuses when BILLING_LIVE=true in the process", async () => {
    const before = process.env.BILLING_LIVE;
    process.env.BILLING_LIVE = "true";
    try {
      expect(() => new MockPaymentProvider()).toThrow(BillingLiveError);
    } finally {
      if (before === undefined) delete process.env.BILLING_LIVE;
      else process.env.BILLING_LIVE = before;
    }
  });
  it("no real provider, network or key anywhere in src/lib/billing", () => {
    const dir = __dirname;
    const banned = [/from\s+["'](stripe|omise|opn|@stripe|2c2p|xendit|gbprimepay|node:https?|https?|axios|undici|node-fetch)/i, /\bfetch\s*\(/, /https?:\/\//, /sk_(live|test)_/, /\bXMLHttpRequest\b/];
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts") && !x.endsWith(".test.ts"))) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const re of banned) expect(src, `${f} matches ${re}`).not.toMatch(re);
    }
  });
});

describe("collecting a due payment", () => {
  const sub = () => startSubscription({ businessId: "b1", plan: "pro", today: "2026-03-10" });
  const now = new Date("2026-04-10T03:00:00Z");
  const buyer = { displayName: "Nong Barber" };

  it("success issues a numbered receipt and moves the due date", async () => {
    const n = new InvoiceNumberer();
    const r = await collectDue({ sub: sub(), now, provider: new MockPaymentProvider(), buyer, numberer: n });
    expect(r.outcome).toBe("paid");
    expect(r.invoice?.number).toBe("TN-2026-000001");
    expect(r.sub.dueDate).toBe("2026-05-10");
  });
  it("a decline consumes no invoice number and starts the grace clock", async () => {
    const n = new InvoiceNumberer();
    const bad = new MockPaymentProvider().willReturn("b1", "declined");
    const r = await collectDue({ sub: sub(), now, provider: bad, buyer, numberer: n });
    expect(r.outcome).toBe("failed");
    expect(r.invoice).toBeNull();
    expect(r.sub.status).toBe("past_due");
    const ok = await collectDue({ sub: r.sub, now: new Date("2026-04-11T03:00:00Z"), provider: bad, buyer, numberer: n, attempt: 2 });
    expect(ok.invoice?.number).toBe("TN-2026-000001"); // first number ever issued
    expect(ok.sub.status).toBe("active");
  });
  it("a timeout changes nothing; the retry with the same attempt does not double charge", async () => {
    const n = new InvoiceNumberer();
    const p = new MockPaymentProvider().willReturn("b1", "timeout");
    const a = await collectDue({ sub: sub(), now, provider: p, buyer, numberer: n });
    expect(a.outcome).toBe("unknown");
    expect(a.sub.status).toBe("active");
    const b = await collectDue({ sub: a.sub, now, provider: p, buyer, numberer: n });
    expect(b.outcome).toBe("paid");
    expect(p.succeededCount).toBe(1);
  });
  it("nothing is charged before the due date or in a free founding month", async () => {
    const p = new MockPaymentProvider();
    const n = new InvoiceNumberer();
    expect((await collectDue({ sub: sub(), now: new Date("2026-04-09T03:00:00Z"), provider: p, buyer, numberer: n })).outcome).toBe("not_due");
    const f = startSubscription({ businessId: "b1", plan: "pro", founding: true, today: "2026-11-03" });
    expect((await collectDue({ sub: f, now: new Date("2026-12-03T03:00:00Z"), provider: p, buyer, numberer: n })).outcome).toBe("not_due");
    expect(p.succeededCount).toBe(0);
  });
});

describe("first-charge refund (mock only)", () => {
  it("within 7 days of the first charge only", async () => {
    const { refundFirstCharge, RefundNotAllowedError } = await import("./service");
    const { buildInvoice } = await import("./invoice");
    const inv = buildInvoice({
      businessId: "b1", plan: "pro", founding: false, anchor: "2026-03-10", periodIndex: 1, buyer: { displayName: "x" },
      issuedAt: new Date("2026-04-10T03:00:00Z"), numbering: { year: 2026, seq: 1, number: "TN-2026-000001" }, paymentRef: "mock_ch_1",
    });
    const p = new MockPaymentProvider();
    const ok = await refundFirstCharge({ invoice: inv, isFirstCharge: true, now: new Date("2026-04-17T03:00:00Z"), provider: p });
    expect(ok).toMatchObject({ amountSatang: 49_000 });
    await expect(refundFirstCharge({ invoice: inv, isFirstCharge: true, now: new Date("2026-04-18T03:00:00Z"), provider: p })).rejects.toBeInstanceOf(RefundNotAllowedError);
    await expect(refundFirstCharge({ invoice: inv, isFirstCharge: false, now: new Date("2026-04-11T03:00:00Z"), provider: p })).rejects.toBeInstanceOf(RefundNotAllowedError);
  });
});
