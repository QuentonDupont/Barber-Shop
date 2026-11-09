"use server";

// Owner billing actions (tatnat-accounts-billing handoff 07). DEMO DATA ONLY:
// every change runs against the mock payment provider and the mock database.
// Outside mock mode these refuse with a plain message, because writing billing
// rows needs the billing job's service role and real charging stays off until
// the CEO says so (decision 25). Customers have no way in: every action starts
// with requireBusiness().
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/auth";
import { isMockMode } from "@/lib/mock/config";
import { errorState, successState, type ActionState } from "./types";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import {
  FOUNDING,
  PLANS,
  buildInvoice,
  bangkokDate,
  cancel as cancelSub,
  createPaymentProvider,
  formatInvoiceNumber,
  isPlanId,
  startSubscription,
  undoCancel,
  type Invoice,
  type PlanId,
  type Subscription,
} from "@/lib/billing";
import { barbersToDeactivate, previewPlanChange, simulateScenario, type DemoScenario } from "@/lib/billing/ui";
import { loadBillingView, subscriptionToPatch } from "@/lib/billing/repo";

const PAGE = "/dashboard/account/billing";

function demoOnly(locale: Locale): ActionState | null {
  return isMockMode() ? null : errorState(t(locale, "billing.notSwitchedOn"));
}

const planName = (locale: Locale, p: PlanId) => (locale === "th" ? PLANS[p].nameTh : PLANS[p].nameEn);

export async function changePlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = await getLocale();
  const blocked = demoOnly(locale);
  if (blocked) return blocked;

  const target = String(formData.get("plan") ?? "");
  if (!isPlanId(target)) return errorState(t(locale, "billing.pickPlan"));
  const wantsFounding = formData.get("founding") === "on";
  const keepIds = formData.getAll("keep").map(String);

  const ctx = await requireBusiness();
  const db = await createClient();
  const now = new Date();
  const view = await loadBillingView(db, ctx.business.id, now);

  // The founding offer: once per shop, only on Pro from Free, only while the cohort has room.
  let foundingOffered = false;
  if (wantsFounding) {
    const { data: all } = await db.from("subscriptions").select("business_id, founding_granted_at");
    const granted = (all ?? []).filter((r) => r.founding_granted_at && r.business_id !== ctx.business.id).length;
    if (view.foundingGrantedAt || granted >= FOUNDING.cohortCap) {
      return errorState(t(locale, "billing.foundingUnavailable"));
    }
    foundingOffered = true;
  }

  const preview = previewPlanChange({
    sub: view.sub,
    now,
    target,
    activeBarbers: view.activeBarbers,
    foundingOffered,
  });
  if (preview.kind === "same") return errorState(t(locale, "billing.alreadyOnPlan"));
  if (wantsFounding && !preview.startsFounding) return errorState(t(locale, "billing.foundingUnavailable"));
  // Auto-renewal consent (Legal C): an unticked box, price stated, before any paid plan starts.
  if (target !== "free" && formData.get("consent") !== "on") return errorState(t(locale, "billing.consentRequired"));

  const active = view.staff.filter((s) => s.isActive).map((s) => ({ id: s.id, createdAt: s.createdAt }));
  if (preview.mustChooseBarbers && keepIds.length > 0 && keepIds.length !== preview.newLimit) {
    return errorState(t(locale, "billing.chooseBarbers", { count: preview.newLimit }));
  }

  // 1. Take the first payment (demo card, mock provider) before anything changes.
  let invoice: Invoice | null = null;
  const today = bangkokDate(now);
  const cardOnFile = view.card != null;
  if (preview.chargeNowSatang > 0) {
    if (!cardOnFile) return errorState(t(locale, "billing.needCard"));
    const provider = createPaymentProvider();
    const res = await provider.charge({
      businessId: ctx.business.id,
      amountSatang: preview.chargeNowSatang,
      currency: "THB",
      description: `TatNat ${target} plan (demo)`,
      idempotencyKey: `${ctx.business.id}:change:${target}:${now.getTime()}`,
    });
    if (res.status === "failed") return errorState(t(locale, "billing.cardDeclined"));
    const year = Number(today.slice(0, 4));
    const { data: sameYear } = await db.from("invoices").select("seq").eq("year", year);
    const seq = Math.max(0, ...(sameYear ?? []).map((r) => r.seq)) + 1;
    invoice = buildInvoice({
      businessId: ctx.business.id,
      plan: target,
      founding: false,
      anchor: today,
      periodIndex: 0,
      buyer: { displayName: ctx.business.name },
      issuedAt: now,
      numbering: { year, seq, number: formatInvoiceNumber(year, seq) },
      paymentRef: res.providerRef,
    });
  }

  // 2. The new subscription.
  let next: Subscription;
  if (target === "free") {
    next = {
      ...view.sub,
      planId: "free",
      previousPlanId: view.sub.planId,
      status: "downgraded",
      founding: false,
      graceUntil: null,
      cancelAtPeriodEnd: false,
      dueDate: today,
    };
  } else {
    next = {
      ...startSubscription({
        businessId: ctx.business.id,
        plan: target,
        founding: preview.startsFounding,
        cardOnFile,
        today,
      }),
      previousPlanId: view.sub.planId === "free" ? view.sub.previousPlanId : view.sub.planId,
    };
  }
  const patch = subscriptionToPatch(next);
  if (preview.startsFounding) patch.founding_granted_at = now.toISOString();
  const { error: subError } = await db.from("subscriptions").update(patch).eq("business_id", ctx.business.id);
  if (subError) return errorState(subError.message);

  // 3. Barbers beyond the new limit go inactive. Nothing is deleted, nothing is unpublished.
  if (preview.mustChooseBarbers) {
    const off = barbersToDeactivate(active, preview.newLimit, keepIds);
    if (off.length > 0) {
      await db.from("staff").update({ is_active: false }).in("id", off).eq("business_id", ctx.business.id);
    }
  }

  // 4. The receipt.
  if (invoice) {
    const id = globalThis.crypto.randomUUID();
    await db.from("invoices").insert({
      id,
      business_id: invoice.businessId,
      year: invoice.year,
      seq: invoice.seq,
      number: invoice.number,
      kind: invoice.kind,
      full_form: invoice.fullForm,
      status: "paid",
      issued_at: invoice.issuedAt.toISOString(),
      issue_date: invoice.issueDate,
      period_start: invoice.periodStart,
      period_end: invoice.periodEnd,
      currency: "THB",
      subtotal_satang: invoice.subtotalSatang,
      vat_satang: invoice.vatSatang,
      vat_rate_bp: invoice.vatRateBp,
      vat_applied: invoice.vatApplied,
      total_satang: invoice.totalSatang,
      buyer: { ...invoice.buyer },
      payment_ref: invoice.paymentRef,
      refunded_at: null,
      refund_ref: null,
    });
    await db.from("invoice_lines").insert(
      invoice.lines.map((l, i) => ({
        invoice_id: id,
        position: i + 1,
        description_th: l.descriptionTh,
        description_en: l.descriptionEn,
        quantity: l.quantity,
        unit_satang: l.unitSatang,
        amount_satang: l.amountSatang,
      })),
    );
  }

  revalidatePath("/dashboard", "layout");
  return successState(t(locale, "billing.planChanged", { plan: planName(locale, target) }));
}

export async function cancelPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = await getLocale();
  const blocked = demoOnly(locale);
  if (blocked) return blocked;
  const undo = formData.get("undo") === "true";
  const ctx = await requireBusiness();
  const db = await createClient();
  const view = await loadBillingView(db, ctx.business.id, new Date());
  try {
    const next = undo ? undoCancel(view.sub) : cancelSub(view.sub);
    await db.from("subscriptions").update(subscriptionToPatch(next)).eq("business_id", ctx.business.id);
  } catch {
    return errorState(t(locale, "billing.nothingToCancel"));
  }
  revalidatePath(PAGE);
  return successState(t(locale, undo ? "billing.cancelUndone" : "billing.cancelScheduled"));
}

/** Demo card: one click, no card number is ever typed or stored. */
export async function demoCardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = await getLocale();
  const blocked = demoOnly(locale);
  if (blocked) return blocked;
  const remove = formData.get("remove") === "true";
  const ctx = await requireBusiness();
  const db = await createClient();
  await db.from("payment_methods").delete().eq("business_id", ctx.business.id);
  if (!remove) {
    await db.from("payment_methods").insert({
      business_id: ctx.business.id,
      brand: "Visa",
      last4: "4242",
      exp_month: 12,
      exp_year: 2030,
      provider_ref: "mock_pm_demo",
    });
  }
  await db.from("subscriptions").update({ card_on_file: !remove }).eq("business_id", ctx.business.id);
  revalidatePath(PAGE);
  return successState(t(locale, remove ? "billing.cardRemoved" : "billing.cardAdded"));
}

/** Demo controls: walk the real state machine through a missed payment so the owner notices can be seen. */
export async function demoScenarioAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = await getLocale();
  const blocked = demoOnly(locale);
  if (blocked) return blocked;
  const scenario = String(formData.get("scenario") ?? "") as DemoScenario;
  if (!["failed", "grace", "lapsed", "reset"].includes(scenario)) return errorState(t(locale, "billing.pickPlan"));
  const ctx = await requireBusiness();
  const db = await createClient();
  const now = new Date();
  const view = await loadBillingView(db, ctx.business.id, now);
  let result;
  try {
    result = simulateScenario(view.sub, scenario, now);
  } catch {
    return errorState(t(locale, "billing.nothingToSimulate"));
  }
  await db.from("subscriptions").update(subscriptionToPatch(result.sub)).eq("business_id", ctx.business.id);
  if (result.actions.some((a) => a.type === "downgrade_to_free")) {
    const active = view.staff.filter((s) => s.isActive).map((s) => ({ id: s.id, createdAt: s.createdAt }));
    const off = barbersToDeactivate(active, PLANS.free.maxBarbers);
    if (off.length > 0) await db.from("staff").update({ is_active: false }).in("id", off).eq("business_id", ctx.business.id);
  }
  revalidatePath("/dashboard", "layout");
  return successState(t(locale, "billing.scenarioApplied"));
}
