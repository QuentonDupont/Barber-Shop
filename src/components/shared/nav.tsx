"use client";

import { cloneElement, isValidElement, type ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

export interface NavItem {
  href: string;
  label: string;
  /**
   * A rendered icon element (`<LayoutDashboard />`), not the component
   * itself. These arrays are built in a Server Component layout and passed
   * down to this client module; a bare component reference is a function and
   * cannot cross that boundary, but an already-created element can — the
   * className/strokeWidth below are applied by cloning it.
   */
  icon: ReactElement;
  /** Treat any deeper path as this item too. */
  matchPrefix?: boolean;
}

function sizedIcon(icon: ReactElement, className: string, strokeWidth: number) {
  if (!isValidElement<{ className?: string; strokeWidth?: number }>(icon)) return icon;
  return cloneElement(icon, { className, strokeWidth });
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
  const t = useT();
  const isActive = useIsActive();

  return (
    <nav
      aria-label={t("customer.primaryNav")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface",
        "pb-safe md:hidden",
      )}
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 px-1 py-2",
                  "text-xs font-semibold",
                  active ? "text-fg" : "text-fg-muted active:text-fg",
                )}
              >
                {sizedIcon(item.icon, "size-6", 2)}
                <span className="truncate max-w-full">{item.label}</span>
                {active ? (
                  <span aria-hidden className="absolute bottom-1 size-1 rounded-full bg-accent" />
                ) : null}
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
  const t = useT();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-bg md:flex md:flex-col">
      {header ? <div className="border-b border-border p-4">{header}</div> : null}

      <nav aria-label={t("customer.primaryNav")} className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-full px-3.5 py-2 text-sm",
                    active
                      ? "bg-surface-muted font-semibold text-fg"
                      : "font-medium text-fg-muted hover:bg-surface-muted/60 hover:text-fg",
                  )}
                >
                  {sizedIcon(item.icon, "size-5 shrink-0", 2)}
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
