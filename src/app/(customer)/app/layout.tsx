import Link from "next/link";
import { CalendarCheck, Compass, Ticket, UserRound } from "lucide-react";
import { AppShell } from "@/components/shared/app-shell";
import { TopBar } from "@/components/shared/top-bar";
import { Logo } from "@/components/shared/logo";
import { AccountMenu } from "@/components/shared/account-menu";
import type { NavItem } from "@/components/shared/nav";
import { requireCustomer } from "@/lib/auth";

/**
 * Every screen behind this layout is specific to the signed-in user, so none of
 * it may ever be prerendered or shared from a cache.
 */
export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/app", label: "Explore", icon: <Compass /> },
  { href: "/app/whats-on", label: "What's on", icon: <Ticket />, matchPrefix: true },
  { href: "/app/bookings", label: "Bookings", icon: <CalendarCheck />, matchPrefix: true },
  { href: "/app/account", label: "Account", icon: <UserRound />, matchPrefix: true },
];

export default async function CustomerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireCustomer();
  const name = session.profile.full_name || "Your account";

  return (
    <AppShell
      items={NAV}
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
