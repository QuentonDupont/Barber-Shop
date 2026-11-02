import Link from "next/link";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

/**
 * Mobile header. Sticky so the brand and the account action stay reachable,
 * but only 56px tall so it does not eat a phone screen.
 */
export function TopBar({
  title,
  right,
  className,
  href = "/",
}: {
  title?: string;
  right?: React.ReactNode;
  className?: string;
  href?: string;
}) {
  return (
    <header
      className={cn(
        // Phone only: from md the sidebar carries the brand and the account
        // menu, so a desktop top bar would be an empty 56px band.
        "sticky top-0 z-30 border-b border-border bg-bg pt-safe md:hidden",
        className,
      )}
    >
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        {title ? (
          <p className="truncate text-base font-semibold">{title}</p>
        ) : (
          <Link href={href} className="md:hidden">
            <Logo />
          </Link>
        )}
        <div className="flex shrink-0 items-center gap-1.5">{right}</div>
      </div>
    </header>
  );
}
