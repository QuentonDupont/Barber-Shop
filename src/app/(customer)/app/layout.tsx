import Link from "next/link";
import { CalendarCheck, Compass, Ticket, UserRound } from "lucide-react";
import { AppShell } from "@/components/shared/app-shell";
import { TopBar } from "@/components/shared/top-bar";
import { Logo } from "@/components/shared/logo";
import { AccountMenu } from "@/components/shared/account-menu";
import type { NavItem } from "@/components/shared/nav";
import { requireCustomer } from "@/lib/auth";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

/**
 * Every screen behind this layout is specific to the signed-in user, so none of
 * it may ever be prerendered or shared from a cache.
 */
export const dynamic = "force-dynamic";

function navItems(locale: Locale): NavItem[] {
  return [
    { href: "/app", label: t(locale, "customer.explore"), icon: <Compass /> },
    { href: "/app/whats-on", label: t(locale, "customer.whatsOn"), icon: <Ticket />, matchPrefix: true },
    { href: "/app/bookings", label: t(locale, "customer.bookings"), icon: <CalendarCheck />, matchPrefix: true },
    { href: "/app/account", label: t(locale, "customer.account"), icon: <UserRound />, matchPrefix: true },
  ];
}

export default async function CustomerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireCustomer();
  const locale = await getLocale();
  const name = session.profile.full_name || t(locale, "customer.yourAccount");

  return (
    <AppShell
      items={navItems(locale)}
      sidebarHeader={
        <Link href="/app">
          <Logo />
        </Link>
      }
      sidebarFooter={
        <AccountMenu name={name} email={session.email} variant="sidebar" />
      }
      topBar={
        <TopBar
          href="/app"
          right={<AccountMenu name={name} email={session.email} variant="compact" />}
        />
      }
    >
      {children}
    </AppShell>
  );
}
