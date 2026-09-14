import type { Metadata } from "next";
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
              Bookly is free for shops. Create a separate business account to
              publish your own booking page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="lg" block>
              <Link href="/sign-up?role=business_owner">
                <Store />
                Set up a business
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
