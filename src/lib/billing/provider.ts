// Payment provider boundary. Only a mock exists. There is deliberately no real
// provider code, SDK, key or network call anywhere in src/lib/billing, and
// everything is gated behind BILLING_LIVE (default false). Real charging needs
// the Thai company, a bank account, provider approval, a tax check and a
// separate CEO go-ahead (decision 25), and will add its own code then.

export class BillingLiveError extends Error {}

/** Server-side assertion. Throws if anyone sets BILLING_LIVE=true: nothing here can go live. */
export function assertBillingNotLive(env: Record<string, string | undefined> = process.env): void {
  const v = (env.BILLING_LIVE ?? "false").trim().toLowerCase();
  if (v !== "false" && v !== "" && v !== "0") {
    throw new BillingLiveError("BILLING_LIVE is set, but no live payment provider exists in this build. Refusing to run.");
  }
}

export interface ChargeRequest {
  businessId: string;
  amountSatang: number;
  currency: "THB";
  description: string;
  /** Same key = same charge: a retry must never charge twice. */
  idempotencyKey: string;
}

export type ChargeResult =
  | { status: "succeeded"; providerRef: string }
  | { status: "failed"; providerRef: string; reason: "declined" | "insufficient_funds" | "expired_card" };

export class ProviderTimeoutError extends Error {}

export interface PaymentProvider {
  readonly name: string;
  readonly live: false;
  /** May throw ProviderTimeoutError: the outcome is then unknown; retry with the same key. */
  charge(req: ChargeRequest): Promise<ChargeResult>;
  /**
   * Refund a charge once. The same `idempotencyKey` returns the first result;
   * refunding the same charge again under another key throws AlreadyRefundedError.
   */
  refund(providerRef: string, amountSatang: number, idempotencyKey?: string): Promise<{ providerRef: string }>;
}

export class AlreadyRefundedError extends Error {}

export type MockOutcome = "succeeded" | "declined" | "insufficient_funds" | "expired_card" | "timeout";

/** Scripted fake. Outcomes are consumed in order per business, then `fallback`. */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  readonly live = false as const;
  private script = new Map<string, MockOutcome[]>();
  private done = new Map<string, ChargeResult>();
  private refunds = new Map<string, { providerRef: string }>();
  private refundedCharges = new Set<string>();
  private counter = 0;
  /** Number of real (non-replayed) charges that succeeded, for tests. */
  succeededCount = 0;

  constructor(private fallback: MockOutcome = "succeeded") {
    assertBillingNotLive();
  }

  willReturn(businessId: string, ...outcomes: MockOutcome[]): this {
    this.script.set(businessId, [...(this.script.get(businessId) ?? []), ...outcomes]);
    return this;
  }

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    assertBillingNotLive();
    if (!Number.isInteger(req.amountSatang) || req.amountSatang <= 0) throw new RangeError("amount must be a positive whole number of satang");
    const replay = this.done.get(req.idempotencyKey);
    if (replay) return replay;
    const outcome = this.script.get(req.businessId)?.shift() ?? this.fallback;
    if (outcome === "timeout") throw new ProviderTimeoutError("mock provider timed out");
    const providerRef = `mock_ch_${++this.counter}`;
    const result: ChargeResult =
      outcome === "succeeded" ? { status: "succeeded", providerRef } : { status: "failed", providerRef, reason: outcome };
    this.done.set(req.idempotencyKey, result);
    if (result.status === "succeeded") this.succeededCount += 1;
    return result;
  }

  async refund(providerRef: string, amountSatang: number, idempotencyKey?: string): Promise<{ providerRef: string }> {
    assertBillingNotLive();
    if (!providerRef.startsWith("mock_")) throw new Error("not a mock charge");
    if (amountSatang <= 0) throw new RangeError("refund must be positive");
    const replay = idempotencyKey ? this.refunds.get(idempotencyKey) : undefined;
    if (replay) return replay;
    if (this.refundedCharges.has(providerRef)) throw new AlreadyRefundedError(`${providerRef} was already refunded`);
    const result = { providerRef: `mock_re_${++this.counter}` };
    this.refundedCharges.add(providerRef);
    if (idempotencyKey) this.refunds.set(idempotencyKey, result);
    return result;
  }
}

/** The only way to get a provider. There is no live branch to take. */
export function createPaymentProvider(env: Record<string, string | undefined> = process.env): PaymentProvider {
  assertBillingNotLive(env);
  return new MockPaymentProvider();
}
