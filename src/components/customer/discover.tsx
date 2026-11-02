"use client";

import { useEffect, useMemo, useState } from "react";
import { LocateFixed, Search, SearchX, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { BusinessCard, type BusinessSummary } from "./business-card";
import { distanceKm } from "@/lib/geo";
import type { BusinessCategory } from "@/lib/database.types";
import { categoryLabel } from "@/lib/i18n/dictionaries";
import { useT, useLocale } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

interface Listing extends BusinessSummary {
  lat: number | null;
  lng: number | null;
}

const CATEGORIES: (BusinessCategory | "all")[] = [
  "all",
  "barber",
  "salon",
  "spa",
  "clinic",
  "fitness",
  "event",
  "other",
];

type GeoState = "idle" | "asking" | "granted" | "denied" | "unsupported";

export function Discover({ businesses }: { businesses: Listing[] }) {
  const t = useT();
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BusinessCategory | "all">("all");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");

  // Only ask for location if the browser already granted it. An unprompted
  // permission dialog on first paint is the fastest way to get a "block".
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeo("unsupported");
      return;
    }
    if (!navigator.permissions?.query) return;

    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (cancelled || status.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (cancelled) return;
            setOrigin({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            setGeo("granted");
          },
          () => undefined,
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeo("unsupported");
      return;
    }
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGeo("granted");
      },
      () => setGeo("denied"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const withDistance = businesses.map((business) => ({
      ...business,
      distanceKm:
        origin && business.lat != null && business.lng != null
          ? distanceKm(origin, { lat: business.lat, lng: business.lng })
          : null,
    }));

    const filtered = withDistance.filter((business) => {
      if (category !== "all" && business.category !== category) return false;
      if (!needle) return true;
      return (
        business.name.toLowerCase().includes(needle) ||
        business.address?.toLowerCase().includes(needle) ||
        business.description?.toLowerCase().includes(needle) ||
        categoryLabel(business.category, locale).toLowerCase().includes(needle) ||
        categoryLabel(business.category, "en").toLowerCase().includes(needle)
      );
    });

    // Nearest first when we know where the user is; otherwise alphabetical, so
    // the order is at least stable and predictable.
    filtered.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [businesses, query, category, origin, locale]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-fg-subtle" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("discover.searchPlaceholder")}
          className="rounded-full pl-11 pr-11"
          enterKeyHint="search"
          aria-label={t("discover.searchAriaLabel")}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle transition-colors hover:text-fg"
            aria-label={t("discover.clearSearchAriaLabel")}
          >
            <X className="size-4.5" />
          </button>
        ) : null}
      </div>

      {/* Category chips scroll sideways rather than wrapping into three rows and
          pushing the results off a phone screen. */}
      <div
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
        role="group"
        aria-label={t("discover.filterAriaLabel")}
      >
        {CATEGORIES.map((value) => {
          const active = value === category;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              aria-pressed={active}
              className={cn(
                "appt-press min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold",
                "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                active
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border bg-surface text-fg-muted hover:text-fg",
              )}
            >
              {value === "all" ? t("discover.all") : categoryLabel(value, locale)}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-fg-muted">
          {t(results.length === 1 ? "discover.placeCountOne" : "discover.placeCountMany", {
            n: results.length,
          })}
          {origin ? t("discover.nearestFirstSuffix") : ""}
        </p>
        {geo !== "granted" && geo !== "unsupported" ? (
          <Button
            variant="outline"
            size="sm"
            className="min-w-0 shrink"
            onClick={requestLocation}
            loading={geo === "asking"}
          >
            <LocateFixed />
            <span className="truncate">
              {geo === "denied" ? t("discover.locationBlocked") : t("discover.sortNearest")}
            </span>
          </Button>
        ) : null}
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t("discover.nothingMatchesTitle")}
          description={t("discover.nothingMatchesDescription")}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
            >
              {t("discover.clearFilters")}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </div>
      )}
    </div>
  );
}
