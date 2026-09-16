import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/shared/app-shell";
import { TopBar } from "@/components/shared/top-bar";
import { Logo } from "@/components/shared/logo";
import { AccountMenu } from "@/components/shared/account-menu";
import { Badge } from "@/components/ui/badge";
import type { NavItem } from "@/components/shared/nav";
import { getOwnerContext } from "@/lib/auth";

/**
 * Every screen behind this layout is specific to the signed-in user, so none of
 * it may ever be prerendered or shared from a cache.
 */
export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Today", icon: "today" },
  { href: "/dashboard/calendar", label: "Calendar", icon: "calendar", matchPrefix: true },
  { href: "/dashboard/services", label: "Services", icon: "services", matchPrefix: true },
  { href: "/dashboard/hours", label: "Hours", icon: "hours", matchPrefix: true },
  { href: "/dashboard/shopfront", label: "Shopfront", icon: "shopfront", matchPrefix: true },
  { href: "/dashboard/settings", label: "Settings", icon: "settings", matchPrefix: true },
];

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getOwnerContext();

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
                    href={`/app/b/${ctx.business.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                  >
                    Live page
                    <ExternalLink className="size-3" />
                  </Link>
                ) : (
                  <Badge tone="warning">Not published</Badge>
                )}
              </div>
            </div>
          ) : null}
        </div>
      }
      sidebarFooter={
        <AccountMenu
          name={ctx.profile.full_name || "Your account"}
          email={ctx.email}
          variant="sidebar"
        />
      }
      topBar={
        <TopBar
          href="/dashboard"
          right={
            <AccountMenu
              name={ctx.profile.full_name || "Your account"}
              email={ctx.email}
              variant="compact"
            />
          }
        />
      }
    >
      {children}
    </AppShell>
  );
}
