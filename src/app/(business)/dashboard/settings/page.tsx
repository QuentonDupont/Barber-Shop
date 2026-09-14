import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { SettingsForm } from "@/components/business/settings-form";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { count } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("business_id", ctx.business.id)
    .eq("is_active", true);

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Your details, your booking rules and whether your page is live."
      />
      <SettingsForm business={ctx.business} activeServiceCount={count ?? 0} />
    </PageContainer>
  );
}
