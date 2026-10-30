/**
 * Small shared helpers for the shopfront (merch + campaigns).
 *
 * Accent tints are written as full, static class strings so Tailwind sees them
 * — never interpolate the colour name into a class. They use translucent tones
 * that read on both the light and dark surfaces (the app themes via CSS
 * variables, not `dark:` utilities), so no dark variants are needed.
 */

import { formatInBusinessTz } from "@/lib/booking/time";
import { t, type Locale } from "@/lib/i18n/dictionaries";

export const SHOP_ACCENTS = ["amber", "rose", "emerald", "sky", "violet"] as const;
export type ShopAccent = (typeof SHOP_ACCENTS)[number];

const TILE: Record<ShopAccent, string> = {
  amber: "bg-amber-500/15 text-amber-600",
  rose: "bg-rose-500/15 text-rose-600",
  emerald: "bg-emerald-500/15 text-emerald-600",
  sky: "bg-sky-500/15 text-sky-600",
  violet: "bg-violet-500/15 text-violet-600",
};

const SWATCH: Record<ShopAccent, string> = {
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
};

function normalize(accent: string | null | undefined): ShopAccent {
  return (SHOP_ACCENTS as readonly string[]).includes(accent ?? "")
    ? (accent as ShopAccent)
    : "amber";
}

/** Soft tinted background + matching text, for an emoji/art tile. */
export function accentTile(accent: string | null | undefined): string {
  return TILE[normalize(accent)];
}

/** Solid swatch, for the colour picker and small dots. */
export function accentSwatch(accent: string | null | undefined): string {
  return SWATCH[normalize(accent)];
}

/* -------------------------------------------------------------------------- */
/* Campaign date formatting (all display is in the business's own time zone)   */
/* -------------------------------------------------------------------------- */

/** Split a UTC instant into `date` (YYYY-MM-DD) and `time` (HH:MM) in a tz. */
export function zonedParts(iso: string | null, tz: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { date, time };
}

/**
 * "Sat 12 Sep · 18:00" for an event, "12 Sep – 19 Sep" for a sale.
 *
 * `locale` is optional and defaults to English, same convention as
 * `formatInBusinessTz` itself (no behaviour change for a call site that
 * hasn't switched to `useT()`/`useLocale()` yet) — pass the active locale
 * explicitly once a call site has (handoff 07 closes this for the owner
 * shopfront page; `campaign-card.tsx`'s customer-facing use is untouched,
 * same as the rest of that component).
 */
export function formatCampaignWhen(
  campaign: { kind: "event" | "sale"; starts_at: string; ends_at: string | null },
  tz: string,
  locale: Locale = "en",
): string {
  const { starts_at: start, ends_at } = campaign;

  if (campaign.kind === "event") {
    return `${formatInBusinessTz(start, tz, "EEE d MMM", locale)} · ${formatInBusinessTz(start, tz, "HH:mm", locale)}`;
  }

  if (ends_at) {
    return `${formatInBusinessTz(start, tz, "d MMM", locale)} – ${formatInBusinessTz(ends_at, tz, "d MMM", locale)}`;
  }
  return `${t(locale, "campaign.fromPrefix")} ${formatInBusinessTz(start, tz, "EEE d MMM", locale)}`;
}
