// Reads the owner's billing rows into the domain types from state.ts / invoice.ts.
// Works on any Supabase client (real, under RLS, or the mock): the owner can
// only ever read their own business's rows. Nothing here writes; plan changes
// live in src/lib/actions/billing.ts. Never imported by a customer screen.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, InvoiceLineRow, InvoiceRow, SubscriptionRow } from "@/lib/database.types";
import type { Buyer, Invoice } from "./invoice";
import { PLAN_IDS, type PlanId } from "./plans";
import { startSubscription, type Subscription } from "./state";
import { bangkokDate } from "./time";

type Db = SupabaseClient<Database>;

export function rowToSubscription(r: SubscriptionRow): Subscription {
  return {
    businessId: r.business_id,
    planId: PLAN_IDS.includes(r.plan_id) ? r.plan_id : "free",
    previousPlanId: r.previous_plan_id,
    status: r.status,
    founding: r.founding,
    anchor: r.anchor,
    periodIndex: r.period_index,
    dueDate: r.due_date ?? r.anchor,
    graceUntil: r.grace_until ? new Date(r.grace_until) : null,
    reminderSentFor: r.reminder_sent_for,
    cardOnFile: r.card_on_file,
    firstChargeRemindersSent: [...r.first_charge_reminders],
    dunningSent: [...r.dunning_sent],
    cancelAtPeriodEnd: r.cancel_at_period_end,
  };
}

export function subscriptionToPatch(s: Subscription): Partial<SubscriptionRow> {
  return {
    plan_id: s.planId,
    previous_plan_id: s.previousPlanId,
    status: s.status,
    founding: s.founding,
    card_on_file: s.cardOnFile,
    first_charge_reminders: s.firstChargeRemindersSent,
    anchor: s.anchor,
    period_index: s.periodIndex,
    due_date: s.dueDate,
    grace_until: s.graceUntil ? s.graceUntil.toISOString() : null,
    reminder_sent_for: s.reminderSentFor,
    dunning_sent: s.dunningSent,
    cancel_at_period_end: s.cancelAtPeriodEnd,
  };
}

export function rowToInvoice(r: InvoiceRow, lines: InvoiceLineRow[]): Invoice {
  const buyer = r.buyer as Record<string, string | undefined>;
  const b: Buyer = {
    displayName: buyer.displayName ?? "",
    legalName: buyer.legalName,
    taxId: buyer.taxId,
    branch: buyer.branch,
    address: buyer.address,
  };
  return {
    number: r.number,
    seq: r.seq,
    year: r.year,
    kind: r.kind,
    fullForm: r.full_form,
    businessId: r.business_id,
    issuedAt: new Date(r.issued_at),
    issueDate: r.issue_date,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    currency: "THB",
    lines: [...lines]
      .sort((a, c) => a.position - c.position)
      .map((l) => ({
        descriptionTh: l.description_th,
        descriptionEn: l.description_en,
        quantity: l.quantity,
        unitSatang: l.unit_satang,
        amountSatang: l.amount_satang,
      })),
    subtotalSatang: r.subtotal_satang,
    vatSatang: r.vat_satang,
    vatRateBp: r.vat_rate_bp,
    vatApplied: r.vat_applied,
    totalSatang: r.total_satang,
    buyer: b,
    paymentRef: r.payment_ref,
  };
}

export interface BillingStaff {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface BillingCard {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface InvoiceListItem {
  id: string;
  number: string;
  issueDate: string;
  totalSatang: number;
  status: "paid" | "void";
  refunded: boolean;
}

export interface BillingView {
  sub: Subscription;
  foundingGrantedAt: string | null;
  staff: BillingStaff[];
  activeBarbers: number;
  invoices: InvoiceListItem[];
  card: BillingCard | null;
}

/** A shop with no subscription row (should not happen) is treated as Free. */
export async function loadBillingView(db: Db, businessId: string, now: Date): Promise<BillingView> {
  const [{ data: subRow }, { data: staffRows }, { data: invRows }, { data: cardRow }] = await Promise.all([
    db.from("subscriptions").select("*").eq("business_id", businessId).maybeSingle(),
    db.from("staff").select("id, name, is_active, created_at").eq("business_id", businessId),
    db
      .from("invoices")
      .select("id, number, issue_date, total_satang, status, refunded_at, seq")
      .eq("business_id", businessId)
      .order("issued_at", { ascending: false }),
    db.from("payment_methods").select("*").eq("business_id", businessId).maybeSingle(),
  ]);
  const sub: Subscription = subRow
    ? rowToSubscription(subRow)
    : startSubscription({ businessId, plan: "free", today: bangkokDate(now) });
  const staff: BillingStaff[] = (staffRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    isActive: s.is_active,
    createdAt: s.created_at,
  }));
  return {
    sub,
    foundingGrantedAt: subRow?.founding_granted_at ?? null,
    staff,
    activeBarbers: staff.filter((s) => s.isActive).length,
    invoices: (invRows ?? []).map((i) => ({
      id: i.id,
      number: i.number,
      issueDate: i.issue_date,
      totalSatang: i.total_satang,
      status: i.status,
      refunded: i.refunded_at != null,
    })),
    card: cardRow
      ? { brand: cardRow.brand, last4: cardRow.last4, expMonth: cardRow.exp_month, expYear: cardRow.exp_year }
      : null,
  };
}

export async function loadInvoice(db: Db, businessId: string, id: string): Promise<Invoice | null> {
  const { data: row } = await db
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!row) return null;
  const { data: lines } = await db.from("invoice_lines").select("*").eq("invoice_id", row.id);
  return rowToInvoice(row, lines ?? []);
}

export type { PlanId };
