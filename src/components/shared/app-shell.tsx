import { cn } from "@/lib/utils";
import { DesktopSidebar, MobileTabBar, type NavItem } from "./nav";

/**
 * The frame both portals sit in.
 *
 * Below `md` the page is a single scrolling column with a fixed tab bar; from
 * `md` up the sidebar becomes persistent and the content column gains its own
 * scroll context. `h-dvh` rather than `h-screen` so the iOS address bar
 * collapsing does not leave a gap at the bottom.
 */
export function AppShell({
  items,
  sidebarHeader,
  sidebarFooter,
  topBar,
  children,
}: {
  items: NavItem[];
  sidebarHeader?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  topBar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-bg md:h-dvh md:overflow-hidden">
      <DesktopSidebar items={items} header={sidebarHeader} footer={sidebarFooter} />

      <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden">
        {topBar}
        <main className="flex-1 pb-nav md:overflow-y-auto md:pb-0">{children}</main>
      </div>

      <MobileTabBar items={items} />
    </div>
  );
}

/** Consistent max width + gutters for page content. */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-7", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-fg-muted text-pretty">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
