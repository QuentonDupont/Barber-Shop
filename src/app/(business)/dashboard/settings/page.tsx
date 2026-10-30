import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { SettingsForm } from "@/components/business/settings-form";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { PRIVACY_POLICY_ROUTE } from "@/lib/privacy/policy";

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

      {/* Handoff 07 (PDPA, legal-review.md §3): a single link out to the
          bilingual draft privacy policy — not a rebuild of this page, which
          stays Stream T's translation scope otherwise. */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t(locale, "privacy.settingsCardTitle")}</CardTitle>
          <CardDescription>{t(locale, "privacy.settingsCardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="md">
            <Link href={PRIVACY_POLICY_ROUTE} target="_blank">
              {t(locale, "privacy.settingsCardButton")}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Owners live in this dashboard all day and are the most likely to want
          a launcher icon, but the install prompt was only ever mounted on the
          customer account page. The component hides itself once installed. */}
      <div className="mt-4">
        <InstallPrompt />
      </div>
    </PageContainer>
  );
}
