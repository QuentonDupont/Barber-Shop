import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * TatNat brand mark (company/projects/barber-shop/look-and-feel.md §4.4).
 * Renders the light and dark SVG twice and toggles visibility with the
 * .brand-asset-light/-dark utilities (globals.css) so it follows the app's
 * manual theme toggle — the same `.dark` class every colour token uses —
 * rather than the OS's prefers-color-scheme.
 */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  if (showWordmark) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <Image
          src="/brand/wordmark.svg"
          alt="TatNat — ตัดนัด"
          width={420}
          height={120}
          priority
          className="brand-asset-light h-8 w-auto"
        />
        <Image
          src="/brand/wordmark-dark.svg"
          alt=""
          aria-hidden="true"
          width={420}
          height={120}
          priority
          className="brand-asset-dark h-8 w-auto"
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src="/brand/icon-mark.svg"
        alt="TatNat"
        width={64}
        height={64}
        priority
        className="brand-asset-light size-8 shrink-0"
      />
      <Image
        src="/brand/icon-mark-dark.svg"
        alt=""
        aria-hidden="true"
        width={64}
        height={64}
        priority
        className="brand-asset-dark size-8 shrink-0"
      />
    </span>
  );
}
