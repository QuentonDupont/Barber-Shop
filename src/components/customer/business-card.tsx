import Link from "next/link";
import { MapPin, Scissors, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "@/lib/geo";
import { formatMoney } from "@/lib/booking/time";
import type { BusinessCategory } from "@/lib/database.types";

export const CATEGORY_LABEL: Record<BusinessCategory, string> = {
  barber: "Barber",
  salon: "Salon",
  spa: "Spa",
  clinic: "Clinic",
  fitness: "Fitness",
  event: "Events",
  other: "Other",
};

export interface BusinessSummary {
  id: string;
  slug: string;
  name: string;
  category: BusinessCategory;
  description: string | null;
  address: string | null;
  distanceKm?: number | null;
  fromPrice?: number | null;
  currency?: string;
  serviceCount: number;
}

export function BusinessCard({ business }: { business: BusinessSummary }) {
  return (
    <Link
      href={`/app/b/${business.slug}`}
      className="group flex min-w-0 gap-3 rounded-xl border border-border bg-surface p-3.5 transition-colors hover:border-border-strong active:bg-surface-muted"
    >
      {/* A generated monogram rather than a stock photo: a shop with no cover
          image should not look broken next to one that has uploaded one. */}
      <span
        className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-lg font-bold text-accent sm:size-16"
        aria-hidden
      >
        {business.name.trim().charAt(0).toUpperCase() || "?"}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="block min-w-0 truncate font-semibold group-hover:text-accent">
            {business.name}
          </span>
          {business.fromPrice != null ? (
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              from {formatMoney(business.fromPrice, business.currency ?? "THB")}
            </span>
          ) : null}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone="outline">{CATEGORY_LABEL[business.category]}</Badge>
          {business.distanceKm != null ? (
            <Badge tone="accent">
              <MapPin />
              {formatDistance(business.distanceKm)}
            </Badge>
          ) : null}
          <Badge tone="neutral">
            <Scissors />
            {business.serviceCount} service{business.serviceCount === 1 ? "" : "s"}
          </Badge>
        </span>

        {business.address ? (
          <span className="mt-1.5 block truncate text-sm text-fg-subtle">
            {business.address}
          </span>
        ) : business.description ? (
          <span className="mt-1.5 block truncate text-sm text-fg-subtle">
            {business.description}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export { Star };
