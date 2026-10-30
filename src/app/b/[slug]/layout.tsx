import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

/**
 * The public booking page's frame. No tab bar — this page is often the very
 * first thing someone sees, from a link a shop shared — so the header carries
 * the one action that makes sense for whoever is looking.
 */
export const dynamic = "force-dynamic";

export default async function PublicBusinessLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = isSupabaseConfigured() ? await getSession().catch(() => null) : null;
  const role = session?.profile.role;
  const locale = await getLocale();

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-md pt-safe">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={role === "business_owner" ? "/dashboard" : session ? "/app" : "/"}>
            <Logo />
          </Link>
          {!session ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/sign-in?role=customer">{t(locale, "pages.signIn")}</Link>
            </Button>
          ) : role === "business_owner" ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard">{t(locale, "pages.dashboard")}</Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="ghost">
              <Link href="/app/bookings">{t(locale, "pages.myBookings")}</Link>
            </Button>
          )}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
