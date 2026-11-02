import type { BusinessCategory } from "@/lib/database.types";
import { cn, firstGrapheme, graphemes } from "@/lib/utils";

/**
 * A shop's lettered "signboard" tile: the shop's own photo when it has one,
 * otherwise its first word (or first letter) painted on its category's tint.
 *
 * Tints are full static class strings over CSS variables (globals.css
 * `--tile-*`) so Tailwind sees them and they switch with the theme — never
 * interpolate the category into a class name.
 */
const TINT: Record<BusinessCategory, string> = {
  barber: "bg-[var(--tile-barber)] text-[var(--tile-barber-ink)]",
  salon: "bg-[var(--tile-salon)] text-[var(--tile-salon-ink)]",
  spa: "bg-[var(--tile-spa)] text-[var(--tile-spa-ink)]",
  clinic: "bg-[var(--tile-clinic)] text-[var(--tile-clinic-ink)]",
  fitness: "bg-[var(--tile-fitness)] text-[var(--tile-fitness-ink)]",
  event: "bg-[var(--tile-other)] text-[var(--tile-other-ink)]",
  other: "bg-[var(--tile-other)] text-[var(--tile-other-ink)]",
};

/** What goes on the sign: the first word if it is short, else one letter. */
export function shopMarkText(name: string): string {
  const firstWord = name.trim().split(/\s+/)[0] ?? "";
  if (!firstWord) return "?";
  if (graphemes(firstWord).length <= 5) return firstWord;
  return firstGrapheme(firstWord).toUpperCase();
}

export function ShopMark({
  name,
  category,
  coverUrl,
  size = 56,
  className,
}: {
  name: string;
  category: BusinessCategory;
  coverUrl?: string | null;
  size?: 56 | 72;
  className?: string;
}) {
  const frame = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-tile)]",
    size === 72 ? "size-[72px]" : "size-14",
    className,
  );

  if (coverUrl) {
    return (
      <span className={frame} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt="" className="size-full object-cover" />
      </span>
    );
  }

  const text = shopMarkText(name);
  const count = graphemes(text).length;
  const scale = size === 72 ? 72 / 56 : 1;
  const px = Math.round((count === 1 ? 26 : count <= 3 ? 18 : 14) * scale);

  return (
    <span className={cn(frame, TINT[category] ?? TINT.other)} aria-hidden>
      <span
        className="display px-1 leading-none"
        style={{ fontSize: `${px}px`, lineHeight: 1.1, letterSpacing: 0 }}
      >
        {text}
      </span>
    </span>
  );
}
