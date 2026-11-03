import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { OwnerAccountForm } from "@/components/business/owner-account-form";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import type { BusinessLegalRow } from "@/lib/database.types";

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

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, "accountOwner.pageTitle")}
        description={t(locale, "accountOwner.pageDescription")}
      />
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
          taxId: legal?.tax_id ?? "",
          branchCode: legal?.branch_code ?? "00000",
          taxAddress: legal?.tax_address ?? "",
          vatRegistered: legal?.vat_registered ?? false,
        }}
      />
    </PageContainer>
  );
}
