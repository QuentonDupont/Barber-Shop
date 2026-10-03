"use client";

import { useEffect, useMemo, useState } from "react";
import { LocateFixed, Search, SearchX, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { BusinessCard, CATEGORY_LABEL, type BusinessSummary } from "./business-card";
import { distanceKm } from "@/lib/geo";
import type { BusinessCategory } from "@/lib/database.types";
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
        CATEGORY_LABEL[business.category].toLowerCase().includes(needle)
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
  }, [businesses, query, category, origin]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-fg-subtle" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search shops, services or areas"
          className="pl-11 pr-11"
          enterKeyHint="search"
          aria-label="Search businesses"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle transition-colors hover:text-fg"
            aria-label="Clear search"
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
        aria-label="Filter by category"
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
                "min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                active
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border bg-surface text-fg-muted hover:bg-surface-muted",
              )}
            >
              {value === "all" ? "All" : CATEGORY_LABEL[value]}
            </button>
          );
        })}
      </div>

      {geo !== "granted" && geo !== "unsupported" ? (
        <Button
          variant="subtle"
          size="md"
          block
          onClick={requestLocation}
          loading={geo === "asking"}
        >
          <LocateFixed />
          {geo === "denied" ? "Location blocked — sorting A–Z" : "Sort by what's nearest"}
        </Button>
      ) : null}

      <div className="flex items-baseline justify-between">
        <p className="text-sm text-fg-muted">
          {results.length} place{results.length === 1 ? "" : "s"}
          {origin ? " · nearest first" : ""}
        </p>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nothing matches that"
          description="Try a different word, or clear the filters to see everything nearby."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </div>
      )}
    </div>
  );
}
