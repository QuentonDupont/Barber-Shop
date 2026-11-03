// Glue: due-date collection against a PaymentProvider, and invoice issuing.
// Pure orchestration over the state machine; no database access here (the
// Supabase-backed store arrives with the UI work).
import { buildInvoice, InvoiceNumberer, type Buyer, type Invoice, type BillingSettings } from "./invoice";
import { ProviderTimeoutError, type PaymentProvider } from "./provider";
import { amountDueSatang, paymentFailed, paymentSucceeded, tick, type BillingAction, type Subscription } from "./state";
import { bangkokDate } from "./time";

export interface CollectResult {
  sub: Subscription;
  actions: BillingAction[];
  invoice: Invoice | null;
  /** "unknown": the provider timed out; nothing changed, retry with the same key. */
  outcome: "not_due" | "paid" | "failed" | "unknown";
}

/**
 * On or after the due date, try the charge once. Success issues a receipt (and
 * only then consumes an invoice number). A decline starts the grace clock.
 */
export async function collectDue(input: {
  sub: Subscription;
  now: Date;
  provider: PaymentProvider;
  buyer: Buyer;
  numberer: InvoiceNumberer;
  settings?: BillingSettings;
  /** Retry number for this due date (1 first). A timeout retry keeps the same attempt. */
  attempt?: number;
}): Promise<CollectResult> {
  const { sub, now, provider } = input;
  const rolled = tick(sub, now);
  const cur = rolled.sub;
  const due = amountDueSatang(cur);
  const live = cur.status === "trialing" || cur.status === "active" || cur.status === "past_due" || cur.status === "grace";
  if (!live || cur.planId === "free" || due <= 0 || bangkokDate(now) < cur.dueDate) {
    return { sub: cur, actions: rolled.actions, invoice: null, outcome: "not_due" };
  }
  const key = `${cur.businessId}:period:${cur.periodIndex + 1}:attempt:${input.attempt ?? 1}`;
  try {
    const res = await provider.charge({
      businessId: cur.businessId,
      amountSatang: due,
      currency: "THB",
      description: `TatNat ${cur.planId} plan, period ${cur.periodIndex + 1}`,
      idempotencyKey: key,
    });
    if (res.status === "failed") {
      const f = paymentFailed(cur, now);
      return { sub: f.sub, actions: [...rolled.actions, ...f.actions], invoice: null, outcome: "failed" };
    }
    const paid = paymentSucceeded(cur);
    const idx = paid.sub.periodIndex;
    const invoice = buildInvoice({
      businessId: cur.businessId,
      plan: cur.planId,
      founding: cur.founding,
      anchor: cur.anchor,
      periodIndex: idx,
      settings: input.settings,
      buyer: input.buyer,
      issuedAt: now,
      numbering: input.numberer.allocate(Number(bangkokDate(now).slice(0, 4))),
      paymentRef: res.providerRef,
    });
    return { sub: paid.sub, actions: [...rolled.actions, ...paid.actions], invoice, outcome: "paid" };
  } catch (e) {
    if (e instanceof ProviderTimeoutError) return { sub: cur, actions: rolled.actions, invoice: null, outcome: "unknown" };
    throw e;
  }
}

