import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  ExternalLink,
  LayoutDashboard,
  Scissors,
  Settings,
  Store,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/shared/app-shell";
import { TopBar } from "@/components/shared/top-bar";
import { Logo } from "@/components/shared/logo";
import { AccountMenu } from "@/components/shared/account-menu";
import { Badge } from "@/components/ui/badge";
import type { NavItem } from "@/components/shared/nav";
import { getOwnerContext } from "@/lib/auth";
import { businessPath } from "@/lib/routes";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

/**
 * Every screen behind this layout is specific to the signed-in user, so none of
 * it may ever be prerendered or shared from a cache.
 */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getOwnerContext();
  const locale = await getLocale();

  const NAV: NavItem[] = [
    { href: "/dashboard", label: t(locale, "nav.today"), icon: <LayoutDashboard /> },
    { href: "/dashboard/calendar", label: t(locale, "nav.calendar"), icon: <CalendarDays />, matchPrefix: true },
    { href: "/dashboard/services", label: t(locale, "nav.services"), icon: <Scissors />, matchPrefix: true },
    { href: "/dashboard/staff", label: t(locale, "nav.staff"), icon: <Users />, matchPrefix: true },
    { href: "/dashboard/hours", label: t(locale, "nav.hours"), icon: <Clock3 />, matchPrefix: true },
    { href: "/dashboard/shopfront", label: t(locale, "nav.shopfront"), icon: <Store />, matchPrefix: true },
    { href: "/dashboard/settings", label: t(locale, "nav.settings"), icon: <Settings />, matchPrefix: true },
  ];

  const accountName = ctx.profile.full_name || t(locale, "nav.defaultAccountName");

  return (
    <AppShell
      items={NAV}
      sidebarHeader={
        <div className="space-y-2.5">
          <Link href="/dashboard">
            <Logo />
          </Link>
          {ctx.business ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{ctx.business.name}</p>
              <div className="mt-1.5">
                {ctx.business.is_published ? (
                  <Link
                    href={businessPath(ctx.business.slug)}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                  >
                    {t(locale, "nav.livePage")}
                    <ExternalLink className="size-3" />
                  </Link>
                ) : (
                  <Badge tone="warning">{t(locale, "nav.notPublished")}</Badge>
                )}
              </div>
            </div>
          ) : null}
        </div>
      }
      sidebarFooter={
        <AccountMenu name={accountName} email={ctx.email} variant="sidebar" />
      }
      topBar={
        <TopBar
          href="/dashboard"
          right={<AccountMenu name={accountName} email={ctx.email} variant="compact" />}
        />
      }
    >
      {children}
    </AppShell>
  );
}
