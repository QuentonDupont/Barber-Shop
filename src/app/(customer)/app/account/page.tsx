import type { Metadata } from "next";
import { BETA_INVITE_HREF, BETA_INVITE_LABEL } from "@/lib/beta";
import { LogOut, Store } from "lucide-react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { ProfileForm } from "@/components/customer/profile-form";
import { DataRightsPanel } from "@/components/customer/data-rights-panel";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCustomer } from "@/lib/auth";
import { signOutAction } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await requireCustomer();
  const supabase = await createClient();

  // Latest consent record and any still-pending deletion request (handoff 07,
  // items 11 and 13) — scoped to the signed-in user only, same as every other
  // read on this page.
  const [{ data: consentRow }, { data: deletionRow }] = await Promise.all([
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
      <PageHeader title="Account" description="Your details and app settings." />

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
            <CardDescription>
              Shops see your name and number on the bookings you make with them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              fullName={session.profile.full_name}
              phone={session.profile.phone}
              email={session.email}
            />
          </CardContent>
        </Card>

        <DataRightsPanel consent={consent} deletionPending={deletionPending} />

        <InstallPrompt />

        <Card>
          <CardHeader>
            <CardTitle>Run a business?</CardTitle>
            <CardDescription>
              TatNat is in an invite-only beta for shops. Request an invite and
              we&rsquo;ll set up your business account with you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="lg" block>
              <Link href={BETA_INVITE_HREF}>
                <Store />
                {BETA_INVITE_LABEL}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="lg" block className="text-danger">
            <LogOut />
            Sign out
          </Button>
        </form>
      </div>
    </PageContainer>
  );
}
