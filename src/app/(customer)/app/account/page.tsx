import type { Metadata } from "next";
import { BETA_INVITE_HREF, BETA_INVITE_LABEL } from "@/lib/beta";
import { LogOut, Store } from "lucide-react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { ProfileForm } from "@/components/customer/profile-form";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCustomer } from "@/lib/auth";
import { signOutAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await requireCustomer();

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
