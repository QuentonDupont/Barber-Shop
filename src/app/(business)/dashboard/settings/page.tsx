import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { SettingsForm } from "@/components/business/settings-form";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const locale = await getLocale();

  const { count } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("business_id", ctx.business.id)
    .eq("is_active", true);

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, "settingsAdmin.pageTitle")}
        description={t(locale, "settingsAdmin.pageDescription")}
      />
      <SettingsForm business={ctx.business} activeServiceCount={count ?? 0} />

      {/* Owners live in this dashboard all day and are the most likely to want
          a launcher icon, but the install prompt was only ever mounted on the
          customer account page. The component hides itself once installed. */}
      <div className="mt-4">
        <InstallPrompt />
      </div>
    </PageContainer>
  );
}
