import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Receipt } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoBanner } from "@/components/billing/demo-banner";
import { BillingNoticeAlert } from "@/components/billing/billing-notice";
import { PlanPicker } from "@/components/billing/plan-picker";
import { CancelControls, DemoControls, PaymentMethodCard } from "@/components/billing/billing-controls";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock/config";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { FOUNDING, PLANS, PLAN_IDS, type PlanId } from "@/lib/billing/plans";
import { amountDueSatang, effectivePlanId } from "@/lib/billing/state";
import { formatDate, formatMoney } from "@/lib/billing/invoice";
import { loadBillingView } from "@/lib/billing/repo";
import { billingNotice, isUrgent, previewPlanChange, type PlanChangePreview } from "@/lib/billing/ui";

export const metadata: Metadata = { title: "Plan & billing" };

const STATUS_KEY = {
  active: "statusActive",
  trialing: "statusTrialing",
  past_due: "statusPastDue",
  grace: "statusGrace",
  downgraded: "statusDowngraded",
  cancelled: "statusCancelled",
} as const;

/**
 * Owner-only. requireBusiness() sends a customer to their own app, and nothing
 * on this page is reachable from a public or customer route.
 */
export default async function BillingPage() {
  const ctx = await requireBusiness();
  const locale = await getLocale();
  const db = await createClient();
  const now = new Date();
  const view = await loadBillingView(db, ctx.business.id, now);
  const demo = isMockMode();

  const planNow = effectivePlanId(view.sub, now);
  const plan = PLANS[planNow];
  const limit = plan.maxBarbers;
  const notice = billingNotice(view.sub, now);
  const foundingOffered = view.foundingGrantedAt == null && !view.sub.founding;

  const previews = Object.fromEntries(
    PLAN_IDS.map((id) => [
      id,
      previewPlanChange({ sub: view.sub, now, target: id, activeBarbers: view.activeBarbers, foundingOffered: false }),
    ]),
  ) as Record<PlanId, PlanChangePreview>;
  const foundingPreview =
    foundingOffered && planNow === "free"
      ? previewPlanChange({ sub: view.sub, now, target: "pro", activeBarbers: view.activeBarbers, foundingOffered: true })
      : null;

  const paying = view.sub.planId !== "free" && (view.sub.status === "active" || view.sub.status === "trialing" || view.sub.status === "past_due" || view.sub.status === "grace");
  const nextAmount = paying ? amountDueSatang(view.sub) : 0;
  const barbers = view.staff
    .filter((s) => s.isActive)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((s) => ({ id: s.id, name: s.name }));
  const usagePct = Math.min(100, Math.round((view.activeBarbers / limit) * 100));

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title={t(locale, "billing.pageTitle")} description={t(locale, "billing.pageDescription")} />

      <div className="space-y-5">
        <DemoBanner />

        {/* Urgent notices (past due, grace, back on Free) are already shown above every
            dashboard page by the layout; this page adds the quieter ones. */}
        {notice && !isUrgent(notice) ? <BillingNoticeAlert notice={notice} locale={locale} /> : null}

        <Card data-testid="plan-summary">
          <CardHeader>
            <CardDescription>{t(locale, "billing.currentPlan")}</CardDescription>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-2xl" data-testid="current-plan-name">
                {locale === "th" ? plan.nameTh : plan.nameEn}
              </CardTitle>
              <Badge tone={view.sub.status === "past_due" || view.sub.status === "grace" ? "warning" : "success"}>
                {t(locale, `billing.${STATUS_KEY[view.sub.status]}`)}
              </Badge>
              {view.sub.founding ? <Badge tone="accent">{t(locale, "billing.foundingBadge")}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium" data-testid="barber-usage">
                {view.activeBarbers <= limit
                  ? t(locale, "billing.barbersUsage", { used: view.activeBarbers, limit })
                  : t(locale, "billing.barbersUsageOver", { used: view.activeBarbers, limit })}
              </p>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={limit}
                aria-valuenow={Math.min(view.activeBarbers, limit)}
              >
                <div className="h-full rounded-full bg-accent" style={{ width: `${usagePct}%` }} />
              </div>
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-fg-muted">{t(locale, "billing.nextCharge")}</dt>
                <dd className="font-medium" data-testid="next-charge">
                  {paying && view.sub.dueDate && !view.sub.cancelAtPeriodEnd
                    ? t(locale, "billing.nextChargeValue", {
                        date: formatDate(view.sub.dueDate, locale),
                        amount: formatMoney(nextAmount, locale),
                      })
                    : t(locale, "billing.noNextCharge")}
                </dd>
              </div>
            </dl>

            {view.sub.founding ? (
              <p className="rounded-lg bg-accent-soft p-3 text-sm text-accent-ink" data-testid="founding-note">
                {t(locale, "billing.foundingActive")}
              </p>
            ) : foundingOffered && planNow === "free" ? (
              <p className="rounded-lg bg-accent-soft p-3 text-sm text-accent-ink" data-testid="founding-offer">
                {t(locale, "billing.foundingOffer")} ({FOUNDING.cohortCap})
              </p>
            ) : null}

            {paying ? <CancelControls cancelling={view.sub.cancelAtPeriodEnd} canChange={demo} /> : null}
          </CardContent>
        </Card>

        <PlanPicker
          current={planNow}
          foundingOffered={foundingOffered && planNow === "free"}
          previews={previews}
          foundingPreview={foundingPreview}
          barbers={barbers}
          canChange={demo}
        />

        <PaymentMethodCard card={view.card} canChange={demo} />

        <Card data-testid="invoice-list">
          <CardHeader>
            <CardTitle>{t(locale, "billing.invoicesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {view.invoices.length === 0 ? (
              <p className="text-sm text-fg-muted">{t(locale, "billing.invoicesEmpty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {view.invoices.map((inv) => (
                  <li key={inv.id}>
                    <Link
                      href={`/dashboard/account/billing/invoices/${inv.id}`}
                      className="flex min-h-14 items-center gap-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      data-testid="invoice-row"
                    >
                      <Receipt className="size-5 shrink-0 text-fg-muted" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{inv.number}</span>
                        <span className="block text-sm text-fg-muted">
                          {formatDate(inv.issueDate, locale)} · {formatMoney(inv.totalSatang, locale)}
                        </span>
                      </span>
                      <Badge tone={inv.refunded || inv.status === "void" ? "neutral" : "success"}>
                        {inv.refunded
                          ? t(locale, "billing.invoiceRefunded")
                          : inv.status === "void"
                            ? t(locale, "billing.invoiceVoid")
                            : t(locale, "billing.invoicePaid")}
                      </Badge>
                      <ChevronRight className="size-4 text-fg-subtle" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {demo ? <DemoControls /> : null}
      </div>
    </PageContainer>
  );
}
