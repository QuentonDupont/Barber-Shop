"use client";

import Link from "next/link";
import { ShopMark } from "@/components/shared/shop-mark";
import { formatDistance } from "@/lib/geo";
import { formatMoney } from "@/lib/booking/time";
import type { BusinessCategory } from "@/lib/database.types";
import { businessPath } from "@/lib/routes";
import { categoryLabel, t } from "@/lib/i18n/dictionaries";
import { useLocale } from "@/lib/i18n/context";

/**
 * English fallback map kept for any call site not yet updated to read the
 * active locale (e.g. a future server-rendered card) — prefer
 * `categoryLabel(category, locale)` from `@/lib/i18n/dictionaries` in new
 * code, which is locale-aware.
 */
export const CATEGORY_LABEL: Record<BusinessCategory, string> = {
  barber: t("en", "category.barber"),
  salon: t("en", "category.salon"),
  spa: t("en", "category.spa"),
  clinic: t("en", "category.clinic"),
  fitness: t("en", "category.fitness"),
  event: t("en", "category.event"),
  other: t("en", "category.other"),
};

export interface BusinessSummary {
  id: string;
  slug: string;
  name: string;
  category: BusinessCategory;
  description: string | null;
  address: string | null;
  coverUrl?: string | null;
  distanceKm?: number | null;
  fromPrice?: number | null;
  currency?: string;
  serviceCount: number;
  /** Next bookable time, already formatted ("วันนี้ 14:00"). */
  nextFree?: string | null;
}

export function BusinessCard({ business }: { business: BusinessSummary }) {
  const { locale } = useLocale();

  const meta = [
    categoryLabel(business.category, locale),
    t(
      locale,
      business.serviceCount === 1 ? "discover.serviceCountOne" : "discover.serviceCountMany",
      { n: business.serviceCount },
    ),
    business.distanceKm != null ? formatDistance(business.distanceKm) : null,
  ].filter(Boolean);

  return (
    <Link
      href={businessPath(business.slug)}
      className="group flex min-w-0 gap-3.5 rounded-[var(--radius-panel)] border border-border bg-surface p-4 transition-colors duration-150 hover:border-border-strong active:bg-surface-muted"
    >
      <ShopMark name={business.name} category={business.category} coverUrl={business.coverUrl} />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="block min-w-0 truncate text-[17px] font-semibold group-hover:underline">
            {business.name}
          </span>
          {business.fromPrice != null ? (
            <span className="num shrink-0 text-sm font-semibold">
              {t(locale, "discover.fromPrice")}{" "}
              {formatMoney(business.fromPrice, business.currency ?? "THB")}
            </span>
          ) : null}
        </span>

        <span className="mt-0.5 block truncate text-sm text-fg-muted">{meta.join(" · ")}</span>

        {business.address || business.description ? (
          <span className="mt-0.5 block truncate text-sm text-fg-subtle">
            {business.address ?? business.description}
          </span>
        ) : null}

        {business.nextFree ? (
          <span className="num mt-1.5 block truncate text-sm font-semibold text-accent-ink">
            {business.nextFree}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
