import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CreditCard } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { Card } from "@/components/ui/card";
import { OwnerAccountForm } from "@/components/business/owner-account-form";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import type { BusinessLegalRow } from "@/lib/database.types";
import { loadBillingView } from "@/lib/billing/repo";
import { effectivePlanId } from "@/lib/billing/state";
import { PLANS } from "@/lib/billing/plans";
import { maskTaxId } from "@/lib/billing/invoice";

export const metadata: Metadata = { title: "Account" };

/**
 * Owner account: personal details + shop details + owner-only tax details.
 * Customers are redirected by requireBusiness (via getOwnerContext).
 * Keep this page a vertical stack of Cards so another card (e.g. the lead's
 * "Plan & billing" link) can be inserted between the PageHeader and the form.
 */
export default async function OwnerAccountPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const locale = await getLocale();

  const { data } = await supabase
    .from("business_legal")
    .select("*")
    .eq("business_id", ctx.business.id)
    .maybeSingle();
  const legal = (data ?? null) as BusinessLegalRow | null;
  const now = new Date();
  const billing = await loadBillingView(supabase, ctx.business.id, now);
  const plan = PLANS[effectivePlanId(billing.sub, now)];
  const limit = plan.maxBarbers;

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, "accountOwner.pageTitle")}
        description={t(locale, "accountOwner.pageDescription")}
      />
      <Card className="mb-5">
        <Link
          href="/dashboard/account/billing"
          data-testid="billing-link"
          className="flex min-h-14 items-center gap-3 rounded-[var(--radius-panel)] p-4 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <CreditCard className="size-5 shrink-0 text-fg-muted" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t(locale, "billing.accountCardTitle")}</span>
            <span className="block text-sm text-fg-muted">
              {locale === "th" ? plan.nameTh : plan.nameEn} · {t(locale, "billing.barbersUsage", { used: billing.activeBarbers, limit })}
            </span>
          </span>
          <ChevronRight className="size-4 text-fg-subtle" aria-hidden />
        </Link>
      </Card>

      <OwnerAccountForm
        email={ctx.email}
        profile={{ fullName: ctx.profile.full_name, phone: ctx.profile.phone ?? "" }}
        business={{
          name: ctx.business.name,
          address: ctx.business.address ?? "",
          phone: ctx.business.phone ?? "",
          lineId: ctx.business.line_id ?? "",
        }}
        legal={{
          legalName: legal?.legal_name ?? "",
          taxIdMasked: legal?.tax_id ? maskTaxId(legal.tax_id) : "",
          branchCode: legal?.branch_code ?? "00000",
          taxAddress: legal?.tax_address ?? "",
          vatRegistered: legal?.vat_registered ?? false,
        }}
      />
    </PageContainer>
  );
}
