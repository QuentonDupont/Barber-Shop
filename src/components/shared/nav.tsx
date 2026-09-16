"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  Circle,
  Clock3,
  Compass,
  LayoutDashboard,
  Scissors,
  Settings,
  Store,
  Ticket,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Nav items are built in Server Components (the portal layouts) and rendered
 * here in a Client Component. A component reference cannot cross that boundary,
 * so `icon` travels as a plain string key and is resolved to a Lucide icon on
 * this side.
 */
export type NavIcon =
  | "explore"
  | "bookings"
  | "account"
  | "whatson"
  | "today"
  | "calendar"
  | "services"
  | "hours"
  | "shopfront"
  | "settings";

const ICONS: Record<NavIcon, LucideIcon> = {
  explore: Compass,
  bookings: CalendarCheck,
  account: UserRound,
  whatson: Ticket,
  today: LayoutDashboard,
  calendar: CalendarDays,
  services: Scissors,
  hours: Clock3,
  shopfront: Store,
  settings: Settings,
};

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Treat any deeper path as this item too. */
  matchPrefix?: boolean;
}

function useIsActive() {
  const pathname = usePathname();
  return (item: NavItem) => {
    if (item.matchPrefix) {
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    return pathname === item.href;
  };
}

/**
 * Phone navigation: a fixed bottom bar.
 *
 * Bottom rather than top because this is where a thumb rests, and because iOS
 * Safari's own chrome lives there — putting navigation anywhere else means
 * stretching for it one-handed. Padded for the home indicator.
 */
export function MobileTabBar({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95",
        "backdrop-blur-lg pb-safe md:hidden",
      )}
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const active = isActive(item);
          const Icon = ICONS[item.icon] ?? Circle;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.75rem] flex-col items-center justify-center gap-1 px-1 py-2",
                  "text-[0.6875rem] font-semibold transition-colors",
                  active ? "text-accent" : "text-fg-subtle active:text-fg",
                )}
              >
                <Icon
                  className={cn("size-6 transition-transform", active && "scale-105")}
                  strokeWidth={active ? 2.4 : 1.9}
                />
                <span className="truncate max-w-full">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop navigation: a persistent sidebar. */
export function DesktopSidebar({
  items,
  header,
  footer,
}: {
  items: NavItem[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const isActive = useIsActive();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
      {header ? <div className="border-b border-border p-4">{header}</div> : null}

      <nav aria-label="Primary" className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isActive(item);
            const Icon = ICONS[item.icon] ?? Circle;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold",
                    "transition-colors",
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-fg-muted hover:bg-surface-muted hover:text-fg",
                  )}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={active ? 2.3 : 1.9} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {footer ? <div className="border-t border-border p-3">{footer}</div> : null}
    </aside>
  );
}
