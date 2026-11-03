import type { Metadata } from "next";
import { BETA_INVITE_HREF } from "@/lib/beta";
import { LogOut, Store } from "lucide-react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { ProfileForm } from "@/components/customer/profile-form";
import { DataRightsPanel } from "@/components/customer/data-rights-panel";
import { EmailChangeCard } from "@/components/customer/email-change-card";
import { PhotoCard } from "@/components/customer/photo-card";
import { NotificationPrefsCards } from "@/components/customer/notification-prefs-card";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCustomer } from "@/lib/auth";
import { signOutAction } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock/config";
import { avatarDisplayUrl } from "@/lib/storage";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await requireCustomer();
  const locale = await getLocale();
  const supabase = await createClient();

  // Latest consent record and any still-pending deletion request (handoff 07,
  // items 11 and 13) — scoped to the signed-in user only, same as every other
  // read on this page.
  const [{ data: consentRow }, { data: deletionRow }, { data: prefsRow }, photoUrl] = await Promise.all([
    supabase
      .from("consent_records")
      .select("policy_version, consented_at, withdrawn_at")
      .eq("user_id", session.userId)
      .order("consented_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("deletion_requests")
      .select("requested_at")
      .eq("user_id", session.userId)
      .eq("status", "pending")
      .maybeSingle(),
    supabase.from("notification_prefs").select("*").eq("user_id", session.userId).maybeSingle(),
    avatarDisplayUrl(supabase, session.profile.avatar_url),
  ]);

  const consent = consentRow
    ? {
        policyVersion: consentRow.policy_version,
        consentedAt: consentRow.consented_at,
        withdrawnAt: consentRow.withdrawn_at,
      }
    : null;
  const deletionPending = deletionRow ? { requestedAt: deletionRow.requested_at } : null;

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader title={t(locale, "account.title")} description={t(locale, "account.description")} />

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>{t(locale, "account.detailsTitle")}</CardTitle>
            <CardDescription>
              {t(locale, "account.detailsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              fullName={session.profile.full_name}
              phone={session.profile.phone}
            />
          </CardContent>
        </Card>

        <EmailChangeCard
          email={session.email}
          pendingEmail={session.profile.pending_email}
          demo={isMockMode()}
        />

        <PhotoCard photoUrl={photoUrl} />

        <NotificationPrefsCards prefs={prefsRow ?? null} />

        <DataRightsPanel consent={consent} deletionPending={deletionPending} />

        <InstallPrompt />

        <Card>
          <CardHeader>
            <CardTitle>{t(locale, "account.businessTitle")}</CardTitle>
            <CardDescription>
              {t(locale, "account.businessDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="lg" block>
              <Link href={BETA_INVITE_HREF}>
                <Store />
                {t(locale, "landing.requestInvite")}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="lg" block className="text-danger">
            <LogOut />
            {t(locale, "account.signOut")}
          </Button>
        </form>
      </div>
    </PageContainer>
  );
}
