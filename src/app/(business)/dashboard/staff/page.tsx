import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { StaffManager } from "@/components/business/staff-manager";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadStaffWithServices } from "@/lib/booking/availability";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const locale = await getLocale();

  const [staff, { data: services }] = await Promise.all([
    loadStaffWithServices(supabase, ctx.business.id),
    supabase
      .from("services")
      .select("id, name, is_active")
      .eq("business_id", ctx.business.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, "staffAdmin.title")}
        description={t(locale, "staffAdmin.description")}
      />
      <StaffManager staff={staff} services={services ?? []} />
    </PageContainer>
  );
}
